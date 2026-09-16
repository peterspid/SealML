import { Router } from "express";
import { CERT_STATUS } from "../../../shared/chain-enums";
import { newId, sha256Hex, unixNow } from "../hashing";
import { anchor, governorAuthority } from "../chain-client";
import { ownerCommitment, payloads, type CircuitCall } from "../midnight";
import { HttpError, Store } from "../store";

// Supersede every Active certification for a model whose fingerprint just
// changed (or which was deactivated): old seals must not stay Active.
async function supersedeActive(
  store: Store,
  modelId: string,
  circuits: CircuitCall[],
): Promise<string[]> {
  const ledger = await store.load();
  const ids = Object.values(ledger.certifications)
    .filter((c) => c.modelId === modelId && c.status === "Active")
    .map((c) => c.certificationId);
  for (const id of ids) {
    const sup = payloads.markSuperseded(
      id,
      CERT_STATUS.Active,
      CERT_STATUS.Expired,
      governorAuthority(),
    );
    circuits.push(sup);
    await anchor(sup);
  }
  await store.update((l) => {
    for (const id of ids) {
      const rec = l.certifications[id];
      rec.status = "Expired";
      rec.badges.certificationActive = false;
    }
  });
  return ids;
}

export function modelsRouter(store: Store): Router {
  const r = Router();

  r.get("/", async (_req, res, next) => {
    try {
      const ledger = await store.load();
      res.json({ models: Object.values(ledger.models) });
    } catch (e) {
      next(e);
    }
  });

  r.get("/:id", async (req, res, next) => {
    try {
      const ledger = await store.load();
      const m = ledger.models[req.params.id];
      if (!m) throw new HttpError(404, "model not found");
      res.json({ model: m });
    } catch (e) {
      next(e);
    }
  });

  // Register a model fingerprint. Accepts either a precomputed `hash` or
  // raw `modelContent` (hashed server-side). Raw content is never stored.
  r.post("/", async (req, res, next) => {
    try {
      const {
        modelId,
        name,
        version,
        hash,
        modelContent,
        category,
        developer,
        description,
        ownerSecret,
      } = req.body ?? {};
      if (!version) throw new HttpError(400, "version is required");
      if (!category) throw new HttpError(400, "category is required");
      if (!ownerSecret) throw new HttpError(400, "ownerSecret is required");
      const finalHash =
        typeof hash === "string" && hash
          ? hash
          : typeof modelContent === "string" && modelContent
            ? sha256Hex(modelContent)
            : null;
      if (!finalHash) throw new HttpError(400, "hash or modelContent is required");
      const id =
        typeof modelId === "string" && modelId
          ? modelId
          : `${name ?? "model"}-${version}`;
      const ledger = await store.load();
      if (ledger.models[id]) throw new HttpError(409, "model already registered");
      const record = {
        modelId: id,
        modelHash: finalHash,
        version: String(version),
        category,
        ownerCredential: ownerCommitment(String(ownerSecret)),
        developer: developer ?? "",
        description: description ?? "",
        registrationTime: new Date().toISOString(),
        active: true,
        chainTx: null as string | null,
      };
      const call: CircuitCall = payloads.registerModel({
        modelId: id,
        hash: finalHash,
        version: String(version),
        category: String(category),
        ownerCommitment: record.ownerCredential,
        registeredAt: unixNow(),
      });
      const txHash = await anchor(call);
      await store.update((l) => {
        l.models[id] = { ...record, chainTx: txHash };
      });
      res
        .status(201)
        .json({ model: { ...record, chainTx: txHash }, circuit: call });
    } catch (e) {
      next(e);
    }
  });

  // New model version: new fingerprint required before recertification.
  r.post("/:id/version", async (req, res, next) => {
    try {
      const { newVersion, hash, modelContent, ownerSecret } = req.body ?? {};
      if (!newVersion) throw new HttpError(400, "newVersion is required");
      if (!ownerSecret) throw new HttpError(400, "ownerSecret is required");
      const finalHash =
        typeof hash === "string" && hash
          ? hash
          : typeof modelContent === "string" && modelContent
            ? sha256Hex(modelContent)
            : null;
      if (!finalHash) throw new HttpError(400, "hash or modelContent is required");
      const ledger = await store.load();
      const m = ledger.models[req.params.id];
      if (!m) throw new HttpError(404, "model not found");
      if (!m.active) throw new HttpError(403, "model deactivated");
      if (m.ownerCredential !== ownerCommitment(String(ownerSecret)))
        throw new HttpError(403, "not owner");
      if (String(newVersion) === m.version && finalHash.toLowerCase() === m.modelHash.toLowerCase())
        throw new HttpError(400, "nothing changed: new version and fingerprint match current");
      const call = payloads.updateModelVersion({
        modelId: m.modelId,
        newHash: finalHash,
        newVersion: String(newVersion),
        ownerCommitment: m.ownerCredential,
      });
      const txHash = await anchor(call);
      const circuits: CircuitCall[] = [call];
      const fingerprintChanged =
        finalHash.toLowerCase() !== m.modelHash.toLowerCase();
      await store.update((l) => {
        const rec = l.models[req.params.id];
        rec.modelHash = finalHash;
        rec.version = String(newVersion);
        rec.chainTx = txHash;
      });
      // A new fingerprint retires old seals: they certified another binary.
      const superseded = fingerprintChanged
        ? await supersedeActive(store, m.modelId, circuits)
        : [];
      res.json({
        model: (await store.load()).models[req.params.id],
        circuit: call,
        circuits,
        superseded,
      });
    } catch (e) {
      next(e);
    }
  });

  r.post("/:id/deactivate", async (req, res, next) => {
    try {
      const { ownerSecret } = req.body ?? {};
      if (!ownerSecret) throw new HttpError(400, "ownerSecret is required");
      const ledger = await store.load();
      const m = ledger.models[req.params.id];
      if (!m) throw new HttpError(404, "model not found");
      if (m.ownerCredential !== ownerCommitment(String(ownerSecret)))
        throw new HttpError(403, "not owner");
      const call = payloads.deactivateModel(m.modelId, m.ownerCredential);
      const txHash = await anchor(call);
      const circuits: CircuitCall[] = [call];
      await store.update((l) => {
        l.models[req.params.id].active = false;
        l.models[req.params.id].chainTx = txHash;
      });
      const superseded = await supersedeActive(store, m.modelId, circuits);
      res.json({
        model: (await store.load()).models[req.params.id],
        circuit: call,
        circuits,
        superseded,
      });
    } catch (e) {
      next(e);
    }
  });

  return r;
}
