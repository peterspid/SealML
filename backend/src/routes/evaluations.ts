import { Router } from "express";
import type {
  FairnessClaim,
  MetricClaim,
  MetricType,
} from "../../../shared/types";
import { newId, unixNow } from "../hashing";
import { anchor } from "../chain-client";
import { evaluatorCredential, payloads, proofCommitment } from "../midnight";
import { HttpError, Store } from "../store";

const METRICS: MetricType[] = ["accuracy", "precision", "recall", "error-rate"];

function isExpired(iso: string): boolean {
  return new Date(iso).getTime() <= Date.now();
}

export function evaluationsRouter(store: Store): Router {
  const r = Router();

  r.get("/:id", async (req, res, next) => {
    try {
      const ev = (await store.load()).evaluations[req.params.id];
      if (!ev) throw new HttpError(404, "evaluation not found");
      res.json({ evaluation: ev });
    } catch (e) {
      next(e);
    }
  });

  r.get("/", async (_req, res, next) => {
    try {
      res.json({ evaluations: Object.values((await store.load()).evaluations) });
    } catch (e) {
      next(e);
    }
  });

  // Submit an evaluation. Thresholds arrive with the request — the server
  // holds no hardcoded cutoffs. Only claims are recorded; raw predictions
  // and datasets never reach this endpoint.
  r.post("/", async (req, res, next) => {
    try {
      const {
        evaluationId,
        modelId,
        datasetId,
        evaluatorId,
        evaluatorSecret,
        metrics,
        thresholds,
        fairness,
      } = req.body ?? {};
      if (!modelId) throw new HttpError(400, "modelId is required");
      if (!datasetId) throw new HttpError(400, "datasetId is required");
      if (!evaluatorId) throw new HttpError(400, "evaluatorId is required");
      if (typeof evaluatorSecret !== "string" || !evaluatorSecret)
        throw new HttpError(401, "evaluatorSecret is required");
      if (!metrics || typeof metrics !== "object")
        throw new HttpError(400, "metrics is required");
      if (!thresholds || typeof thresholds !== "object")
        throw new HttpError(400, "thresholds is required");

      const ledger = await store.load();
      const model = ledger.models[modelId];
      if (!model) throw new HttpError(404, "model not found");
      if (!model.active) throw new HttpError(403, "model is deactivated");
      const dataset = ledger.datasets[datasetId];
      if (!dataset) throw new HttpError(404, "dataset not found");
      if (dataset.approvalStatus !== "approved")
        throw new HttpError(403, `dataset is ${dataset.approvalStatus}`);
      if (isExpired(dataset.expiresAt))
        throw new HttpError(403, "dataset certification expired");
      const evaluator = ledger.evaluators[evaluatorId];
      if (!evaluator) throw new HttpError(404, "evaluator not found");
      if (
        evaluator.credentialCommitment !==
        evaluatorCredential(String(evaluatorId), evaluatorSecret)
      )
        throw new HttpError(403, "evaluatorSecret invalid");
      if (!evaluator.authorized)
        throw new HttpError(403, "evaluator is not authorized");
      if (isExpired(evaluator.expiresAt))
        throw new HttpError(403, "evaluator authorization expired");

      const minSamples = Number(thresholds.minSamples);
      const samplesEvaluated = Number(metrics.samplesEvaluated);
      if (!Number.isFinite(minSamples) || minSamples <= 0)
        throw new HttpError(400, "thresholds.minSamples must be positive");
      if (!Number.isFinite(samplesEvaluated) || samplesEvaluated <= 0)
        throw new HttpError(400, "metrics.samplesEvaluated must be positive");
      // Mirrors the on-chain assert: samplesEvaluated > minSamples.
      if (!(samplesEvaluated > minSamples))
        throw new HttpError(400, "sample minimum not reached");
      if (samplesEvaluated > dataset.sizeClaim)
        throw new HttpError(400, "samples exceed dataset size claim");

      const metricClaims: MetricClaim[] = METRICS.map((metric) => {
        const value = Number(metrics[metric]);
        const threshold = Number(thresholds[metric]);
        if (!Number.isFinite(value) || !Number.isFinite(threshold))
          throw new HttpError(400, `metrics.${metric} and thresholds.${metric} required`);
        const met =
          metric === "error-rate" ? value < threshold : value > threshold;
        return { metric, threshold, met };
      });

      let fairnessClaim: FairnessClaim | null = null;
      let fairnessMet = true;
      if (fairness && typeof fairness === "object") {
        const delta = Number(fairness.delta);
        const threshold = Number(fairness.threshold);
        if (!Number.isFinite(delta) || !Number.isFinite(threshold))
          throw new HttpError(400, "fairness.delta and fairness.threshold required");
        if (!fairness.metric) throw new HttpError(400, "fairness.metric required");
        fairnessMet = delta < threshold;
        fairnessClaim = {
          metric: String(fairness.metric),
          groups: Array.isArray(fairness.groups)
            ? fairness.groups.map(String)
            : [],
          delta,
          threshold,
          met: fairnessMet,
          conditions: String(fairness.conditions ?? ""),
        };
      }

      const id =
        typeof evaluationId === "string" && evaluationId
          ? evaluationId
          : newId("ev");
      if (ledger.evaluations[id])
        throw new HttpError(409, "evaluation already submitted");

      const evalTimestamp = unixNow();
      const commitment = proofCommitment(
        JSON.stringify({
          id,
          modelId,
          datasetId,
          evaluatorId,
          metricClaims,
          fairnessClaim,
          evalTimestamp,
        }),
      );
      const record = {
        evaluationId: id,
        modelId,
        modelVersionAtEval: model.version,
        modelHashAtEval: model.modelHash,
        datasetId,
        evaluatorId,
        metricClaims,
        fairnessClaim,
        minSamples: Math.floor(minSamples),
        samplesEvaluated: Math.floor(samplesEvaluated),
        proofCommitment: commitment,
        evaluationDate: new Date().toISOString(),
        chainTx: null as string | null,
      };
      const byMetric = (m: MetricType) =>
        metricClaims.find((c) => c.metric === m)?.met ?? false;
      const call = payloads.submitEvaluation({
        evaluationId: id,
        modelId,
        datasetId,
        evaluatorId,
        modelHash: model.modelHash,
        datasetCommitment: dataset.datasetCommitment,
        evaluatorAuthorized: true,
        accuracyMet: byMetric("accuracy"),
        precisionMet: byMetric("precision"),
        recallMet: byMetric("recall"),
        errorMet: byMetric("error-rate"),
        minSamples: Math.floor(minSamples),
        samplesEvaluated: Math.floor(samplesEvaluated),
        fairnessMet,
        fairnessDelta: fairnessClaim
          ? Math.round(fairnessClaim.delta * 10000)
          : 0,
        fairnessThreshold: fairnessClaim
          ? Math.round(fairnessClaim.threshold * 10000)
          : 0,
        fairnessMetric: fairnessClaim ? fairnessClaim.metric : "",
        proofCommitment: commitment,
        evalTimestamp,
      });
      const txHash = await anchor(call);
      await store.update((l) => {
        l.evaluations[id] = { ...record, chainTx: txHash };
      });
      res
        .status(201)
        .json({ evaluation: { ...record, chainTx: txHash }, circuit: call });
    } catch (e) {
      next(e);
    }
  });

  return r;
}
