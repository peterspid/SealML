import { Router } from "express";
import { spawn, type ChildProcess } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { chainMode, config, reloadAddresses } from "../config";
import { CONTRACTS } from "../midnight";
import { HttpError } from "../store";

const CONTRACT_FILES: Record<string, string> = {
  ModelRegistry: "ModelRegistry.compact",
  DatasetRegistry: "DatasetRegistry.compact",
  EvaluatorRegistry: "EvaluatorRegistry.compact",
  EvaluationRegistry: "EvaluationRegistry.compact",
  CertificationRegistry: "CertificationRegistry.compact",
  RevocationRegistry: "RevocationRegistry.compact",
};

interface DeployJob {
  proc: ChildProcess | null;
  running: boolean;
  exitCode: number | null;
  startedAt: string | null;
  logFile: string;
}

const job: DeployJob = {
  proc: null,
  running: false,
  exitCode: null,
  startedAt: null,
  logFile: path.join(process.cwd(), "data", "deploy.log"),
};

async function readLogTail(lines = 60): Promise<string> {
  try {
    const raw = await fs.readFile(job.logFile, "utf8");
    return raw.split("\n").slice(-lines).join("\n");
  } catch {
    return "";
  }
}

export function chainRouter(): Router {
  const r = Router();

  r.get("/status", async (_req, res) => {
    const contracts = await Promise.all(
      Object.keys(CONTRACTS).map(async (name) => {
        const file = CONTRACT_FILES[name];
        let circuits: string[] = [];
        try {
          const infoRaw = await fs.readFile(
            path.join(
              process.cwd(),
              "contracts",
              "build",
              name,
              "compiler",
              "contract-info.json",
            ),
            "utf8",
          );
          const info = JSON.parse(infoRaw);
          const list = Array.isArray(info.circuits) ? info.circuits : [];
          circuits = list.map((c: { name?: string }) => c.name).filter(Boolean);
        } catch {
          circuits = [];
        }
        return {
          name,
          file,
          address: config.addresses[CONTRACTS[name as keyof typeof CONTRACTS]] ?? null,
          circuits,
        };
      }),
    );
    res.json({
      mode: chainMode(),
      networkId: config.networkId,
      nodeUrl: config.nodeUrl,
      indexerUrl: config.indexerUrl,
      walletConfigured: !!config.walletSeed,
      contracts,
    });
  });

  // One-click deploy: runs scripts/deploy-preprod.mjs as a background job.
  // Admin-gated — this spends real wallet funds. Poll deploy/status for
  // progress. Prerequisites (funded WALLET_SEED in .env.preprod + proof
  // server on :6300) are checked by the script itself; failures land in
  // the log, never silently.
  r.post("/deploy", async (req, res, next) => {
    try {
      if (req.body?.adminSecret !== config.adminSecret)
        throw new HttpError(403, "adminSecret invalid");
      if (process.env.VERCEL === "1") {
        throw new HttpError(503, "contract deployment requires a long-running backend; use the preprod deploy command from the operator host");
      }
      if (job.running) {
        res.json({ started: false, reason: "deploy already running", log: await readLogTail(10) });
        return;
      }
      await fs.mkdir(path.dirname(job.logFile), { recursive: true });
      await fs.writeFile(
        job.logFile,
        `[sealml] deploy started ${new Date().toISOString()}\n`,
        "utf8",
      );
      const out = await fs.open(job.logFile, "a");
      const proc = spawn(
        process.execPath,
        [path.join(process.cwd(), "scripts", "deploy-preprod.mjs")],
        { cwd: process.cwd(), stdio: ["ignore", out.fd, out.fd] },
      );
      job.proc = proc;
      job.running = true;
      job.exitCode = null;
      job.startedAt = new Date().toISOString();
      proc.on("exit", (code) => {
        job.running = false;
        job.exitCode = code ?? 1;
        job.proc = null;
        out.close().catch(() => undefined);
        if (code === 0) {
          try {
            reloadAddresses();
          } catch {
            /* addresses refresh on next restart */
          }
        }
      });
      proc.on("error", () => {
        job.running = false;
        job.exitCode = 1;
        job.proc = null;
        out.close().catch(() => undefined);
      });
      res.status(202).json({ started: true, startedAt: job.startedAt });
    } catch (e) {
      next(e);
    }
  });

  r.get("/deploy/status", async (_req, res) => {
    if (job.exitCode === 0) reloadAddresses();
    res.json({
      running: job.running,
      exitCode: job.exitCode,
      startedAt: job.startedAt,
      mode: chainMode(),
      deployed: Object.keys(config.addresses).length,
      log: await readLogTail(80),
    });
  });

  return r;
}
