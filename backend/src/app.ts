import express from "express";
import path from "node:path";
import { config } from "./config";
import { Store, HttpError } from "./store";
import { modelsRouter } from "./routes/models";
import { datasetsRouter, evaluatorsRouter } from "./routes/registries";
import { evaluationsRouter } from "./routes/evaluations";
import { certificationsRouter } from "./routes/certifications";
import { revocationsRouter } from "./routes/revocations";
import { verifyRouter } from "./routes/verify";
import { chainRouter } from "./routes/chain";

const store = new Store(config.ledgerFile);
export const app = express();

// Same-origin app: the UI is served from this server in local mode. On
// Vercel, the static UI is served by the platform and this module is API-only.
app.use(express.json({ limit: "2mb" }));

const hits = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_WRITES_PER_MIN = 120;
app.use("/api/", (req, res, next) => {
  if (req.method === "GET") return next();
  const now = Date.now();
  const key = req.ip ?? "local";
  const arr = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  hits.set(key, arr);
  if (arr.length > MAX_WRITES_PER_MIN) {
    res.status(429).json({ error: "rate limit exceeded, retry shortly" });
    return;
  }
  next();
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "sealml", time: new Date().toISOString() });
});
app.use("/api/models", modelsRouter(store));
app.use("/api/datasets", datasetsRouter(store));
app.use("/api/evaluators", evaluatorsRouter(store));
app.use("/api/evaluations", evaluationsRouter(store));
app.use("/api/certifications", certificationsRouter(store));
app.use("/api/revocations", revocationsRouter(store));
app.use("/api/verify", verifyRouter(store));
app.use("/api/chain", chainRouter());

if (process.env.VERCEL !== "1") {
  const frontendDir = path.join(process.cwd(), "frontend", "dist");
  app.use(express.static(frontendDir));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(frontendDir, "index.html"), (err) => {
      if (err) res.status(404).json({ error: "frontend not built" });
    });
  });
}

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    if (
      typeof err === "object" &&
      err !== null &&
      "status" in err &&
      (err as { status: unknown }).status === 413
    ) {
      res.status(413).json({
        error: "payload too large (2 MB limit): hash large files client-side instead",
      });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "internal error" });
  },
);
