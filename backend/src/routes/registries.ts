import { Router } from "express";
import {
  DATASET_APPROVAL,
  approvalLabel,
} from "../../../shared/chain-enums";
import { config } from "../config";
import { newId, sha256Hex, unixNow, daysFromNow } from "../hashing";
import { anchor, governorAuthority } from "../chain-client";
import {
  evaluatorCredential,
  payloads,
} from "../midnight";
import { HttpError, Store } from "../store";

function requireAdmin(req: { body?: { adminSecret?: unknown } }): void {
  if (req.body?.adminSecret !== config.adminSecret)
    throw new HttpError(403, "adminSecret invalid");
}

export function evaluatorsRouter(store: Store): Router {
  const r = Router();

  r.get("/", async (_req, res, next) => {
    try {
      res.json({ evaluators: Object.values((await store.load()).evaluators) });
    } catch (e) {
      next(e);
    }
  });

  r.get("/:id", async (req, res, next) => {
    try {
      const ev = (await store.load()).evaluators[req.params.id];
      if (!ev) throw new HttpError(404, "evaluator not found");
      res.json({ evaluator: ev });
    } catch (e) {
      next(e);
    }
  });

  r.post("/", async (req, res, next) => {
    try {
      const { evaluatorId, organization, role, credentialSecret, expiresInDays } =
        req.body ?? {};
      if (!organization) throw new HttpError(400, "organization is required");
      if (!role) throw new HttpError(400, "role is required");
      const validRoles = ["university", "auditor", "enterprise", "government"];
      if (!validRoles.includes(role))
        throw new HttpError(400, `role must be one of ${validRoles.join(", ")}`);
      const id =
        typeof evaluatorId === "string" && evaluatorId
          ? evaluatorId
          : newId("eval");
      const ledger = await store.load();
      if (ledger.evaluators[id])
        throw new HttpError(409, "evaluator already registered");
      const days = Number(expiresInDays ?? 365);
      const secret = credentialSecret ?? id;
      const record = {
        evaluatorId: id,
        organization: String(organization),
        role,
        credentialCommitment: evaluatorCredential(id, String(secret)),
        authorized: true,
        expiresAt: new Date(daysFromNow(days) * 1000).toISOString(),
        chainTx: null as string | null,
      };
      const call = payloads.registerEvaluator({
        evaluatorId: id,
        role: String(role),
        org: String(organization),
        credential: record.credentialCommitment,
        expiresAt: Math.floor(new Date(record.expiresAt).getTime() / 1000),
      });
      const txHash = await anchor(call);
      await store.update((l) => {
        l.evaluators[id] = { ...record, chainTx: txHash };
      });
      res
        .status(201)
        .json({ evaluator: { ...record, chainTx: txHash }, circuit: call });
    } catch (e) {
      next(e);
    }
  });

  r.post("/:id/authorize", async (req, res, next) => {
    try {
      requireAdmin(req);
      const { authorized } = req.body ?? {};
      if (typeof authorized !== "boolean")
        throw new HttpError(400, "authorized boolean is required");
      const ledger = await store.load();
      const ev = ledger.evaluators[req.params.id];
      if (!ev) throw new HttpError(404, "evaluator not found");
      const call = payloads.setEvaluatorAuthorized(
        ev.evaluatorId,
        authorized,
        governorAuthority(),
      );
      const txHash = await anchor(call);
      await store.update((l) => {
        l.evaluators[req.params.id].authorized = authorized;
        l.evaluators[req.params.id].chainTx = txHash;
      });
      res.json({
        evaluator: (await store.load()).evaluators[req.params.id],
        circuit: call,
      });
    } catch (e) {
      next(e);
    }
  });

  return r;
}

export function datasetsRouter(store: Store): Router {
  const r = Router();

  r.get("/:id", async (req, res, next) => {
    try {
      const ds = (await store.load()).datasets[req.params.id];
      if (!ds) throw new HttpError(404, "dataset not found");
      res.json({ dataset: ds });
    } catch (e) {
      next(e);
    }
  });

  r.get("/", async (_req, res, next) => {
    try {
      res.json({ datasets: Object.values((await store.load()).datasets) });
    } catch (e) {
      next(e);
    }
  });

  // Certify a dataset commitment. Raw data never accepted here — only the
  // commitment plus public claims.
  r.post("/certify", async (req, res, next) => {
    try {
      const {
        datasetId,
        commitment,
        datasetDescriptor,
        version,
        sizeClaim,
        qualityClaim,
        source,
        categories,
        consent,
        expiresInDays,
      } = req.body ?? {};
      const finalCommitment =
        typeof commitment === "string" && commitment
          ? commitment
          : typeof datasetDescriptor === "string" && datasetDescriptor
            ? sha256Hex(datasetDescriptor)
            : null;
      if (!finalCommitment)
        throw new HttpError(400, "commitment or datasetDescriptor is required");
      if (!version) throw new HttpError(400, "version is required");
      const size = Number(sizeClaim);
      if (!Number.isFinite(size) || size <= 0)
        throw new HttpError(400, "sizeClaim must be a positive number");
      const quality = Number(qualityClaim);
      if (!Number.isFinite(quality) || quality < 0 || quality > 1)
        throw new HttpError(400, "qualityClaim must be between 0 and 1");
      if (consent !== true) throw new HttpError(400, "consent must be true");
      const id =
        typeof datasetId === "string" && datasetId ? datasetId : newId("ds");
      const ledger = await store.load();
      if (ledger.datasets[id])
        throw new HttpError(409, "dataset already certified");
      const days = Number(expiresInDays ?? 180);
      const record = {
        datasetId: id,
        datasetCommitment: finalCommitment,
        datasetVersion: String(version),
        approvalStatus: "approved" as const,
        sizeClaim: Math.floor(size),
        qualityClaim: quality,
        consentFlag: true,
        source: source ?? "",
        categories: Array.isArray(categories) ? categories.map(String) : [],
        expiresAt: new Date(daysFromNow(days) * 1000).toISOString(),
        chainTx: null as string | null,
      };
      const call = payloads.certifyDataset({
        datasetId: id,
        commitment: finalCommitment,
        version: String(version),
        sizeClaim: Math.floor(size),
        qualityClaim: Math.floor(quality * 10000),
        approvedCode: DATASET_APPROVAL.approved,
        expiresAt: Math.floor(new Date(record.expiresAt).getTime() / 1000),
      });
      const txHash = await anchor(call);
      await store.update((l) => {
        l.datasets[id] = { ...record, chainTx: txHash };
      });
      res
        .status(201)
        .json({ dataset: { ...record, chainTx: txHash }, circuit: call });
    } catch (e) {
      next(e);
    }
  });

  r.post("/:id/approval", async (req, res, next) => {
    try {
      requireAdmin(req);
      const { approval } = req.body ?? {};
      const code =
        typeof approval === "number"
          ? approval
          : typeof approval === "string" && approval in DATASET_APPROVAL
            ? DATASET_APPROVAL[approval as keyof typeof DATASET_APPROVAL]
            : NaN;
      if (![0, 1, 2, 3].includes(code))
        throw new HttpError(400, "approval must be pending|approved|revoked|expired");
      const ledger = await store.load();
      const ds = ledger.datasets[req.params.id];
      if (!ds) throw new HttpError(404, "dataset not found");
      const call = payloads.setDatasetApproval(
        ds.datasetId,
        code,
        governorAuthority(),
      );
      const txHash = await anchor(call);
      await store.update((l) => {
        l.datasets[req.params.id].approvalStatus = approvalLabel(code);
        l.datasets[req.params.id].chainTx = txHash;
      });
      res.json({
        dataset: (await store.load()).datasets[req.params.id],
        circuit: call,
      });
    } catch (e) {
      next(e);
    }
  });

  // Permissionless keeper: anyone may mark a truly lapsed dataset
  // expired. The chain checks the timestamp; the backend mirrors it.
  r.post("/:id/expire", async (req, res, next) => {
    try {
      const ledger = await store.load();
      const ds = ledger.datasets[req.params.id];
      if (!ds) throw new HttpError(404, "dataset not found");
      if (ds.approvalStatus === "expired")
        throw new HttpError(400, "dataset already expired");
      if (new Date(ds.expiresAt).getTime() > Date.now())
        throw new HttpError(400, "dataset has not expired yet");
      const call = payloads.expireDataset(
        ds.datasetId,
        unixNow(),
        DATASET_APPROVAL.expired,
      );
      const txHash = await anchor(call);
      await store.update((l) => {
        l.datasets[req.params.id].approvalStatus = "expired";
        l.datasets[req.params.id].chainTx = txHash;
      });
      res.json({
        dataset: (await store.load()).datasets[req.params.id],
        circuit: call,
      });
    } catch (e) {
      next(e);
    }
  });

  return r;
}
