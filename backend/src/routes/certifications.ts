import { Router } from "express";
import { CERT_STATUS, defaultCertLifetimeDays } from "../../../shared/chain-enums";
import type { CertificationBadges } from "../../../shared/types";
import { config } from "../config";
import { newId, unixNow, daysFromNow } from "../hashing";
import { anchor, governorAuthority } from "../chain-client";
import { payloads, type CircuitCall } from "../midnight";
import { HttpError, Store } from "../store";

function isExpired(iso: string): boolean {
  return new Date(iso).getTime() <= Date.now();
}

export function certificationsRouter(store: Store): Router {
  const r = Router();

  r.get("/", async (_req, res, next) => {
    try {
      res.json({ certifications: Object.values((await store.load()).certifications) });
    } catch (e) {
      next(e);
    }
  });

  r.get("/:id", async (req, res, next) => {
    try {
      const c = (await store.load()).certifications[req.params.id];
      if (!c) throw new HttpError(404, "certification not found");
      res.json({ certification: c });
    } catch (e) {
      next(e);
    }
  });

  r.get("/:id/badges", async (req, res, next) => {
    try {
      const c = (await store.load()).certifications[req.params.id];
      if (!c) throw new HttpError(404, "certification not found");
      res.json({ certificationId: c.certificationId, badges: c.badges });
    } catch (e) {
      next(e);
    }
  });

  // Issue a certification. All four gate claims are re-checked here exactly
  // as the Compact circuit asserts them; any failure is a 400 naming the
  // unsatisfied claim.
  r.post("/issue", async (req, res, next) => {
    try {
      const { certificationId, modelId, evaluationId, lifetimeDays } = req.body ?? {};
      if (!modelId) throw new HttpError(400, "modelId is required");
      if (!evaluationId) throw new HttpError(400, "evaluationId is required");
      const ledger = await store.load();
      const model = ledger.models[modelId];
      if (!model) throw new HttpError(404, "model not found");
      const evaluation = ledger.evaluations[evaluationId];
      if (!evaluation) throw new HttpError(404, "evaluation not found");
      if (evaluation.modelId !== modelId)
        throw new HttpError(400, "evaluation is for a different model");
      const dataset = ledger.datasets[evaluation.datasetId];
      const evaluator = ledger.evaluators[evaluation.evaluatorId];
      if (!dataset || !evaluator)
        throw new HttpError(500, "evaluation references unknown dataset/evaluator");

      const datasetOk =
        dataset.approvalStatus === "approved" && !isExpired(dataset.expiresAt);
      const accuracyOk = evaluation.metricClaims.every((c) => c.met);
      const evaluatorOk =
        evaluator.authorized && !isExpired(evaluator.expiresAt);
      // Fingerprint-anchored: the exact evaluated binary must still be the
      // registered one. A hash change under the same version label fails.
      const versionOk =
        model.active &&
        model.version === evaluation.modelVersionAtEval &&
        model.modelHash.toLowerCase() ===
          evaluation.modelHashAtEval.toLowerCase();

      const failures: string[] = [];
      if (!datasetOk) failures.push("dataset claim not satisfied");
      if (!accuracyOk) failures.push("accuracy claim not satisfied");
      if (!evaluatorOk) failures.push("evaluator not authorized");
      if (!versionOk) failures.push("model version not verified");
      if (failures.length > 0)
        throw new HttpError(400, `cannot certify: ${failures.join("; ")}`);

      const id =
        typeof certificationId === "string" && certificationId
          ? certificationId
          : newId("cert");
      if (ledger.certifications[id])
        throw new HttpError(409, "certification already issued");

      const days = Number(lifetimeDays ?? defaultCertLifetimeDays());
      if (!Number.isFinite(days) || days <= 0)
        throw new HttpError(400, "lifetimeDays must be positive");
      const issuedAt = unixNow();
      const record = {
        certificationId: id,
        modelId,
        evaluationId,
        status: "Active" as const,
        issuedAt: new Date(issuedAt * 1000).toISOString(),
        expiresAt: new Date(daysFromNow(days, issuedAt) * 1000).toISOString(),
        badges: {
          datasetVerified: true,
          accuracyThresholdVerified: true,
          evaluatorVerified: true,
          modelVersionVerified: true,
          certificationActive: true,
        } as CertificationBadges,
        txHash: null as string | null,
      };
      const call = payloads.issueCertification({
        certificationId: id,
        modelId,
        evaluationId,
        issuedAt,
        expiresAt: issuedAt + Math.floor(days) * 86400,
        activeCode: CERT_STATUS.Active,
        datasetOk: true,
        accuracyOk: true,
        evaluatorOk: true,
        versionOk: true,
      });
      const txHash = await anchor(call);
      const circuits: CircuitCall[] = [call];
      // Recertification supersedes: older Active seals for the same model
      // retire so exactly one Active certification exists per model.
      const priorActive = Object.values(ledger.certifications)
        .filter((c) => c.modelId === modelId && c.status === "Active")
        .map((c) => c.certificationId);
      for (const priorId of priorActive) {
        const sup = payloads.markSuperseded(
          priorId,
          CERT_STATUS.Active,
          CERT_STATUS.Expired,
          governorAuthority(),
        );
        circuits.push(sup);
        await anchor(sup);
      }
      await store.update((l) => {
        l.certifications[id] = { ...record, txHash };
        for (const priorId of priorActive) {
          const rec = l.certifications[priorId];
          rec.status = "Expired";
          rec.badges.certificationActive = false;
        }
      });
      res.status(201).json({
        certification: { ...record, txHash },
        circuit: call,
        circuits,
      });
    } catch (e) {
      next(e);
    }
  });

  r.post("/:id/expire", async (req, res, next) => {
    try {
      const ledger = await store.load();
      const c = ledger.certifications[req.params.id];
      if (!c) throw new HttpError(404, "certification not found");
      if (c.status !== "Active")
        throw new HttpError(400, `certification is ${c.status}`);
      if (!isExpired(c.expiresAt))
        throw new HttpError(400, "certification has not expired yet");
      const call = payloads.expireCertification(
        c.certificationId,
        unixNow(),
        CERT_STATUS.Active,
        CERT_STATUS.Expired,
      );
      const txHash = await anchor(call);
      await store.update((l) => {
        const rec = l.certifications[req.params.id];
        rec.status = "Expired";
        rec.badges.certificationActive = false;
        rec.txHash = txHash;
      });
      res.json({
        certification: (await store.load()).certifications[req.params.id],
        circuit: call,
      });
    } catch (e) {
      next(e);
    }
  });

  // Restore a revoked certification. Admin-gated, and every gate claim
  // is re-checked exactly as at issuance — restoration is recertification
  // against current registry state, not forgiveness.
  r.post("/:id/restore", async (req, res, next) => {
    try {
      if (req.body?.adminSecret !== config.adminSecret)
        throw new HttpError(403, "adminSecret invalid");
      const ledger = await store.load();
      const c = ledger.certifications[req.params.id];
      if (!c) throw new HttpError(404, "certification not found");
      if (c.status !== "Revoked")
        throw new HttpError(400, `certification is ${c.status}, not Revoked`);
      const model = ledger.models[c.modelId];
      const evaluation = ledger.evaluations[c.evaluationId];
      if (!model || !evaluation)
        throw new HttpError(500, "certification references unknown records");
      const dataset = ledger.datasets[evaluation.datasetId];
      const evaluator = ledger.evaluators[evaluation.evaluatorId];
      if (!dataset || !evaluator)
        throw new HttpError(500, "evaluation references unknown records");
      const ok =
        dataset.approvalStatus === "approved" &&
        !isExpired(dataset.expiresAt) &&
        evaluation.metricClaims.every((m) => m.met) &&
        evaluator.authorized &&
        !isExpired(evaluator.expiresAt) &&
        model.active &&
        model.version === evaluation.modelVersionAtEval &&
        model.modelHash.toLowerCase() ===
          evaluation.modelHashAtEval.toLowerCase();
      if (!ok)
        throw new HttpError(400, "gate claims no longer hold; re-evaluate instead");
      const call = payloads.restoreCertification(
        c.certificationId,
        CERT_STATUS.Revoked,
        CERT_STATUS.Active,
        governorAuthority(),
      );
      const txHash = await anchor(call);
      await store.update((l) => {
        const rec = l.certifications[req.params.id];
        rec.status = "Active";
        rec.badges = {
          datasetVerified: true,
          accuracyThresholdVerified: true,
          evaluatorVerified: true,
          modelVersionVerified: true,
          certificationActive: true,
        };
        rec.txHash = txHash;
      });
      res.json({
        certification: (await store.load()).certifications[req.params.id],
        circuit: call,
      });
    } catch (e) {
      next(e);
    }
  });

  return r;
}
