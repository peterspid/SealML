import { Router } from "express";
import type { VerifyBundle } from "../../../shared/types";
import { sha256Hex } from "../hashing";
import { HttpError, Store } from "../store";

function latestCertForModel(
  ledger: Awaited<ReturnType<Store["load"]>>,
  modelId: string,
) {
  const certs = Object.values(ledger.certifications)
    .filter((c) => c.modelId === modelId)
    .sort((a, b) => (a.issuedAt < b.issuedAt ? 1 : -1));
  return certs[0] ?? null;
}

export function verifyRouter(store: Store): Router {
  const r = Router();

  // Public verification bundle: everything a consumer needs, nothing private.
  r.get("/:modelId", async (req, res, next) => {
    try {
      const ledger = await store.load();
      const model = ledger.models[req.params.modelId];
      if (!model) throw new HttpError(404, "model not found");
      const cert = latestCertForModel(ledger, model.modelId);
      if (!cert) {
        const bundle: VerifyBundle = {
          modelId: model.modelId,
          version: model.version,
          status: "Uncertified",
          modelHash: model.modelHash,
          claims: [],
          fairness: null,
          evaluatorId: null,
          evaluatorAuthorized: false,
          issuedAt: null,
          expiresAt: null,
          revoked: false,
          revocationReason: null,
          txHash: null,
        };
        res.json({ bundle, model });
        return;
      }
      const evaluation = ledger.evaluations[cert.evaluationId];
      const evaluator = evaluation
        ? ledger.evaluators[evaluation.evaluatorId]
        : undefined;
      const revocation = Object.values(ledger.revocations).find(
        (v) => v.certificationId === cert.certificationId,
      );
      const bundle: VerifyBundle = {
        modelId: model.modelId,
        version: model.version,
        status: cert.status,
        modelHash: model.modelHash,
        claims: evaluation?.metricClaims ?? [],
        fairness: evaluation?.fairnessClaim ?? null,
        evaluatorId: evaluation?.evaluatorId ?? null,
        evaluatorAuthorized: evaluator?.authorized ?? false,
        issuedAt: cert.issuedAt,
        expiresAt: cert.expiresAt,
        revoked: cert.status === "Revoked",
        revocationReason: revocation?.reason ?? null,
        txHash: cert.txHash,
      };
      res.json({ bundle, model, certification: cert });
    } catch (e) {
      next(e);
    }
  });

  // Selective disclosure: reveal only the requested claim families.
  r.get("/:modelId/disclosure", async (req, res, next) => {
    try {
      const ledger = await store.load();
      const model = ledger.models[req.params.modelId];
      if (!model) throw new HttpError(404, "model not found");
      const cert = latestCertForModel(ledger, model.modelId);
      if (!cert) throw new HttpError(404, "no certification for this model");
      const evaluation = ledger.evaluations[cert.evaluationId];
      const raw = req.query.reveal;
      const reveal = new Set(
        (Array.isArray(raw) ? raw : String(raw ?? "").split(","))
          .flatMap((s) => String(s).split(","))
          .map((s) => s.trim())
          .filter(Boolean),
      );
      const disclosed: Record<string, unknown> = {
        modelId: model.modelId,
        status: cert.status,
      };
      if (reveal.has("accuracy") && evaluation) {
        disclosed.accuracy = evaluation.metricClaims.map((c) => ({
          metric: c.metric,
          threshold: c.threshold,
          met: c.met,
        }));
      }
      if (reveal.has("size") && evaluation) {
        const ds = ledger.datasets[evaluation.datasetId];
        if (ds) {
          disclosed.datasetSize = ds.sizeClaim;
          disclosed.datasetApproved = ds.approvalStatus;
        }
      }
      if (reveal.has("evaluator") && evaluation) {
        const ev = ledger.evaluators[evaluation.evaluatorId];
        if (ev) {
          disclosed.evaluator = {
            organization: ev.organization,
            role: ev.role,
            authorized: ev.authorized,
          };
        }
      }
      if (reveal.has("fairness") && evaluation?.fairnessClaim) {
        disclosed.fairness = evaluation.fairnessClaim;
      }
      res.json({ disclosed, revealed: [...reveal] });
    } catch (e) {
      next(e);
    }
  });

  // Model integrity: hash the provided content and compare with the
  // certified fingerprint. Match / No match — never false positives:
  // unknown models and missing hashes are errors, not matches.
  r.post("/integrity", async (req, res, next) => {
    try {
      const { modelId, modelContent, hash } = req.body ?? {};
      if (!modelId) throw new HttpError(400, "modelId is required");
      const ledger = await store.load();
      const model = ledger.models[modelId];
      if (!model) throw new HttpError(404, "model not found");
      const candidate =
        typeof hash === "string" && hash
          ? hash
          : typeof modelContent === "string" && modelContent
            ? sha256Hex(modelContent)
            : null;
      if (!candidate)
        throw new HttpError(400, "modelContent or hash is required");
      const match =
        candidate.toLowerCase() === model.modelHash.toLowerCase();
      res.json({
        modelId,
        match,
        verdict: match ? "Match" : "No match",
        certifiedHash: model.modelHash,
        certifiedVersion: model.version,
      });
    } catch (e) {
      next(e);
    }
  });

  return r;
}
