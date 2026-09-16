import { Router } from "express";
import { CERT_STATUS, REVOCATION_REASON } from "../../../shared/chain-enums";
import type { RevocationReason } from "../../../shared/types";
import { newId, unixNow } from "../hashing";
import { anchor, governorAuthority } from "../chain-client";
import {
  evaluatorCredential,
  ownerCommitment,
  payloads,
  type CircuitCall,
} from "../midnight";
import { HttpError, Store } from "../store";

const REASONS = Object.keys(REVOCATION_REASON) as RevocationReason[];

function isExpired(iso: string): boolean {
  return new Date(iso).getTime() <= Date.now();
}

export function revocationsRouter(store: Store): Router {
  const r = Router();

  r.get("/", async (req, res, next) => {
    try {
      const all = Object.values((await store.load()).revocations);
      const cert = req.query.certificationId;
      res.json({
        revocations: typeof cert === "string" ? all.filter((v) => v.certificationId === cert) : all,
      });
    } catch (e) {
      next(e);
    }
  });

  // Revoke a certification. The revoker proves identity with a secret:
  // an authorized evaluator's credential secret (revokerEvaluatorId +
  // revokerSecret) or the model owner's secret (ownerSecret). Public IDs
  // alone revoke nothing.
  r.post("/", async (req, res, next) => {
    try {
      const {
        certificationId,
        reason,
        revokerEvaluatorId,
        revokerSecret,
        ownerSecret,
      } = req.body ?? {};
      if (!certificationId) throw new HttpError(400, "certificationId is required");
      if (!REASONS.includes(reason))
        throw new HttpError(400, `reason must be one of ${REASONS.join(", ")}`);
      const ledger = await store.load();
      const cert = ledger.certifications[certificationId];
      if (!cert) throw new HttpError(404, "certification not found");
      if (cert.status !== "Active")
        throw new HttpError(400, `certification is ${cert.status}`);

      let revokerCredential: string;
      if (typeof revokerEvaluatorId === "string" && revokerEvaluatorId) {
        const ev = ledger.evaluators[revokerEvaluatorId];
        if (!ev) throw new HttpError(404, "revoker evaluator not found");
        if (
          typeof revokerSecret !== "string" ||
          ev.credentialCommitment !==
            evaluatorCredential(revokerEvaluatorId, revokerSecret)
        )
          throw new HttpError(403, "revokerSecret invalid");
        if (!ev.authorized || isExpired(ev.expiresAt))
          throw new HttpError(403, "revoker is not an authorized evaluator");
        revokerCredential = ev.credentialCommitment;
      } else if (typeof ownerSecret === "string" && ownerSecret) {
        const model = ledger.models[cert.modelId];
        if (!model) throw new HttpError(500, "certification references unknown model");
        if (model.ownerCredential !== ownerCommitment(ownerSecret))
          throw new HttpError(403, "not owner");
        revokerCredential = model.ownerCredential;
      } else {
        throw new HttpError(400, "revokerEvaluatorId+revokerSecret or ownerSecret is required");
      }

      const revocationId = newId("rev");
      const timestamp = unixNow();
      const revokeCall = payloads.revokeCertification({
        revocationId,
        certificationId,
        reason: String(reason),
        revokerCommitment: revokerCredential,
        timestamp,
      });
      const markCall = payloads.markRevoked(
        certificationId,
        CERT_STATUS.Active,
        CERT_STATUS.Revoked,
        governorAuthority(),
      );
      const circuits: CircuitCall[] = [revokeCall, markCall];
      const txRevoke = await anchor(revokeCall);
      await anchor(markCall);
      await store.update((l) => {
        l.revocations[revocationId] = {
          revocationId,
          certificationId,
          reason,
          revokerCredential,
          timestamp: new Date(timestamp * 1000).toISOString(),
          chainTx: txRevoke,
        };
        const c = l.certifications[certificationId];
        c.status = "Revoked";
        c.badges.certificationActive = false;
        c.txHash = txRevoke;
      });
      res.status(201).json({
        revocation: (await store.load()).revocations[revocationId],
        circuits,
      });
    } catch (e) {
      next(e);
    }
  });

  return r;
}
