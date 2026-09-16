// SealML end-to-end feature tests for the complete registry lifecycle.
// Runs against a live backend: BASE_URL (default http://127.0.0.1:3000).
// Each test uses unique IDs so reruns never collide with stored state.
import { test, before } from "node:test";
import assert from "node:assert";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const TAG = Date.now().toString(36);

async function api(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}
const post = (p, d) => api(p, { method: "POST", body: JSON.stringify(d ?? {}) });
const get = (p) => api(p);

const TH = { accuracy: 0.9, precision: 0.85, recall: 0.8, "error-rate": 0.1, minSamples: 100 };
const GOOD = { accuracy: 0.93, precision: 0.9, recall: 0.88, "error-rate": 0.07, samplesEvaluated: 1000 };

let ids;
const ADMIN = process.env.ADMIN_SECRET ?? "sealml-local-admin";
before(() => {
  ids = {
    model: `FraudDetector-${TAG}`,
    dataset: `FraudDataset-${TAG}`,
    evaluator: `eval-${TAG}`,
    owner: `owner-secret-${TAG}`,
    // default credential secret equals the evaluator id (API behavior)
    evSecret: `eval-${TAG}`,
  };
});

await test("F0b: deploy endpoints are admin-gated and report status", async () => {
  const noAdmin = await post("/api/chain/deploy", {});
  assert.equal(noAdmin.status, 403);
  const wrongAdmin = await post("/api/chain/deploy", { adminSecret: "wrong" });
  assert.equal(wrongAdmin.status, 403);
  const st = await get("/api/chain/deploy/status");
  assert.equal(st.status, 200);
  assert.equal(typeof st.body.running, "boolean");
  assert.ok("log" in st.body && "mode" in st.body);
});

await test("F0: health + chain status list all six registries", async () => {
  const h = await get("/api/health");
  assert.equal(h.status, 200);
  const st = await get("/api/chain/status");
  assert.equal(st.status, 200);
  assert.equal(st.body.contracts.length, 6);
  const names = st.body.contracts.map((c) => c.name).sort();
  assert.deepEqual(names, [
    "CertificationRegistry",
    "DatasetRegistry",
    "EvaluationRegistry",
    "EvaluatorRegistry",
    "ModelRegistry",
    "RevocationRegistry",
  ]);
});

await test("F1: model registration (happy + duplicate + missing field)", async () => {
  const r = await post("/api/models", {
    modelId: ids.model, name: "FraudDetector", version: "v1",
    modelContent: "weights-blob-v1", category: "fraud-detection",
    developer: "Acme AI", description: "demo", ownerSecret: ids.owner,
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.model.modelId, ids.model);
  assert.match(r.body.model.modelHash, /^[0-9a-f]{64}$/);
  assert.equal(r.body.circuit.contract, "ModelRegistry");
  assert.equal(r.body.circuit.circuit, "registerModel");
  // payload descriptor carries the exact circuit args (operate path submits these)
  assert.deepEqual(
    Object.keys(r.body.circuit.args).sort(),
    ["category", "hash", "modelKey", "ownerCommitment", "registeredAt", "version"],
  );

  const dup = await post("/api/models", {
    modelId: ids.model, version: "v1", modelContent: "x",
    category: "fraud-detection", ownerSecret: ids.owner,
  });
  assert.equal(dup.status, 409);

  const missing = await post("/api/models", { version: "v1" });
  assert.equal(missing.status, 400);
});

await test("F2: version control (new fingerprint, wrong owner rejected)", async () => {
  const bad = await post(`/api/models/${ids.model}/version`, {
    newVersion: "v2", modelContent: "evil-blob", ownerSecret: "wrong",
  });
  assert.equal(bad.status, 403);
  const ok = await post(`/api/models/${ids.model}/version`, {
    newVersion: "v2", modelContent: "weights-blob-v2", ownerSecret: ids.owner,
  });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.model.version, "v2");
  assert.notEqual(ok.body.model.modelHash, undefined);
  // restore v1 fingerprint baseline for later steps? No — keep v2, certify v2.
  ids.version = "v2";
});

await test("F3: dataset certification (happy + consent refused)", async () => {
  const noConsent = await post("/api/datasets/certify", {
    datasetId: ids.dataset, datasetDescriptor: "manifest", version: "v3",
    sizeClaim: 100000, qualityClaim: 0.95, consent: false,
  });
  assert.equal(noConsent.status, 400);
  const r = await post("/api/datasets/certify", {
    datasetId: ids.dataset, datasetDescriptor: "manifest", version: "v3",
    sizeClaim: 100000, qualityClaim: 0.95, source: "certified bank",
    categories: ["fraud"], consent: true,
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.dataset.approvalStatus, "approved");
  assert.equal(r.body.circuit.circuit, "certifyDataset");
});

await test("F6: evaluator registry (register + suspend blocks submit)", async () => {
  const r = await post("/api/evaluators", {
    evaluatorId: ids.evaluator, organization: "Northbridge Lab", role: "university",
  });
  assert.equal(r.status, 201);
  assert.equal(r.body.evaluator.authorized, true);
  const badRole = await post("/api/evaluators", { organization: "X", role: "wizard" });
  assert.equal(badRole.status, 400);
  // authorization changes are admin-gated
  const noAdmin = await post(`/api/evaluators/${ids.evaluator}/authorize`, { authorized: false });
  assert.equal(noAdmin.status, 403);
  const wrongAdmin = await post(`/api/evaluators/${ids.evaluator}/authorize`, { authorized: false, adminSecret: "wrong" });
  assert.equal(wrongAdmin.status, 403);
});

await test("F4+F5: evaluation claims + fairness (happy + sample-minimum + unauthorized)", async () => {
  const ev = (extra) => ({
    modelId: ids.model, datasetId: ids.dataset, evaluatorId: ids.evaluator,
    evaluatorSecret: ids.evSecret, metrics: GOOD, thresholds: TH, ...extra,
  });
  // identity is proven: missing or wrong secret is rejected
  const noSecret = await post("/api/evaluations", {
    modelId: ids.model, datasetId: ids.dataset, evaluatorId: ids.evaluator,
    metrics: GOOD, thresholds: TH,
  });
  assert.equal(noSecret.status, 401);
  const wrongSecret = await post("/api/evaluations", ev({ evaluatorSecret: "nope" }));
  assert.equal(wrongSecret.status, 403);

  const tooFew = await post("/api/evaluations", ev({
    metrics: { ...GOOD, samplesEvaluated: 10 },
  }));
  assert.equal(tooFew.status, 400);

  const suspended = await post(`/api/evaluators/${ids.evaluator}/authorize`, { authorized: false, adminSecret: ADMIN });
  assert.equal(suspended.status, 200);
  const blocked = await post("/api/evaluations", ev({}));
  assert.equal(blocked.status, 403);
  await post(`/api/evaluators/${ids.evaluator}/authorize`, { authorized: true, adminSecret: ADMIN });

  const r = await post("/api/evaluations", ev({
    fairness: { metric: "group-error-rate-delta", groups: ["a", "b"], delta: 0.03, threshold: 0.05, conditions: "test" },
  }));
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.circuit.circuit, "submitEvaluation");
  assert.ok(r.body.evaluation.metricClaims.every((c) => c.met));
  assert.equal(r.body.evaluation.fairnessClaim.met, true);
  assert.match(r.body.evaluation.modelHashAtEval, /^[0-9a-f]{64}$/);
  // linkage + fairness now travel in the circuit payload
  assert.deepEqual(
    Object.keys(r.body.circuit.args).sort(),
    ["accuracyMet", "datasetCommitment", "datasetKey", "errorMet", "evalTimestamp", "evaluationKey", "evaluatorAuthorized", "evaluatorKey", "fairnessDelta", "fairnessMet", "fairnessMetric", "fairnessThreshold", "minSamples", "modelHash", "modelKey", "precisionMet", "proofCommitment", "recallMet", "samplesEvaluated"],
  );
  ids.evaluation = r.body.evaluation.evaluationId;
});

await test("F4 negative: failing metrics cannot be certified", async () => {
  const weak = await post("/api/evaluations", {
    modelId: ids.model, datasetId: ids.dataset, evaluatorId: ids.evaluator,
    evaluatorSecret: ids.evSecret,
    metrics: { accuracy: 0.5, precision: 0.9, recall: 0.88, "error-rate": 0.07, samplesEvaluated: 1000 },
    thresholds: TH,
  });
  assert.equal(weak.status, 201);
  const cert = await post("/api/certifications/issue", {
    modelId: ids.model, evaluationId: weak.body.evaluation.evaluationId,
  });
  assert.equal(cert.status, 400);
  assert.match(cert.body.error, /accuracy claim not satisfied/);
});

await test("F7+F12: issue certification with badges (happy path)", async () => {
  const r = await post("/api/certifications/issue", {
    modelId: ids.model, evaluationId: ids.evaluation,
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.certification.status, "Active");
  assert.deepEqual(r.body.certification.badges, {
    datasetVerified: true,
    accuracyThresholdVerified: true,
    evaluatorVerified: true,
    modelVersionVerified: true,
    certificationActive: true,
  });
  assert.equal(r.body.circuit.circuit, "issueCertification");
  ids.cert = r.body.certification.certificationId;

  const badges = await get(`/api/certifications/${ids.cert}/badges`);
  assert.equal(badges.status, 200);
  assert.equal(badges.body.badges.certificationActive, true);
});

await test("F10: public verify bundle has all nine field groups", async () => {
  const r = await get(`/api/verify/${ids.model}`);
  assert.equal(r.status, 200);
  const b = r.body.bundle;
  for (const k of ["modelId", "version", "status", "modelHash", "claims", "evaluatorAuthorized", "issuedAt", "expiresAt", "txHash"]) {
    assert.ok(k in b, `missing ${k}`);
  }
  assert.equal(b.status, "Active");
  assert.equal(b.claims.length, 4);
  const missing = await get("/api/verify/no-such-model");
  assert.equal(missing.status, 404);
});

await test("F11: integrity match / tampered no-match / unknown model", async () => {
  const match = await post("/api/verify/integrity", { modelId: ids.model, modelContent: "weights-blob-v2" });
  assert.equal(match.status, 200);
  assert.equal(match.body.match, true);
  assert.equal(match.body.verdict, "Match");
  const tampered = await post("/api/verify/integrity", { modelId: ids.model, modelContent: "weights-blob-v2+X" });
  assert.equal(tampered.body.match, false);
  assert.equal(tampered.body.verdict, "No match");
  const unknown = await post("/api/verify/integrity", { modelId: "ghost", modelContent: "x" });
  assert.equal(unknown.status, 404);
});

await test("F9: selective disclosure reveals only requested families", async () => {
  const r = await get(`/api/verify/${ids.model}/disclosure?reveal=accuracy`);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.revealed, ["accuracy"]);
  assert.ok("accuracy" in r.body.disclosed);
  assert.ok(!("datasetSize" in r.body.disclosed));
  assert.ok(!("evaluator" in r.body.disclosed));
  const all = await get(`/api/verify/${ids.model}/disclosure?reveal=accuracy,size,evaluator,fairness`);
  assert.ok("datasetSize" in all.body.disclosed);
  assert.ok("evaluator" in all.body.disclosed);
  assert.ok(!("predictions" in all.body.disclosed));
});

await test("F7 expiry: lapsed certification flips Active -> Expired", async () => {
  const ev = await post("/api/evaluations", {
    modelId: ids.model, datasetId: ids.dataset, evaluatorId: ids.evaluator,
    evaluatorSecret: ids.evSecret,
    metrics: GOOD, thresholds: TH,
  });
  assert.equal(ev.status, 201);
  const cert = await post("/api/certifications/issue", {
    modelId: ids.model, evaluationId: ev.body.evaluation.evaluationId, lifetimeDays: 0.000001,
  });
  assert.equal(cert.status, 201);
  const early = await post(`/api/certifications/${ids.cert}/expire`);
  assert.equal(early.status, 400); // main cert not expired yet
  const done = await post(`/api/certifications/${cert.body.certification.certificationId}/expire`);
  assert.equal(done.status, 200);
  assert.equal(done.body.certification.status, "Expired");
  assert.equal(done.body.circuit.circuit, "expireCertification");
});

await test("F8: revocation (bad reason + unauthorized revoker rejected, happy path flips)", async () => {
  // target the model's latest certification (verify shows the latest seal)
  const list = await get("/api/certifications");
  const latest = list.body.certifications
    .filter((c) => c.modelId === ids.model)
    .sort((a, b) => (a.issuedAt < b.issuedAt ? 1 : -1))[0];
  assert.ok(latest);
  // revive it to Active when the expiry test left it Expired
  ids.target = latest.certificationId;
  const badReason = await post("/api/revocations", {
    certificationId: ids.target, reason: "nope", revokerEvaluatorId: ids.evaluator,
    revokerSecret: ids.evSecret,
  });
  assert.equal(badReason.status, 400);
  const badRevoker = await post("/api/revocations", {
    certificationId: ids.target, reason: "model-modified", revokerEvaluatorId: "ghost",
    revokerSecret: "ghost",
  });
  assert.ok([400, 404].includes(badRevoker.status), "unknown revoker must be rejected");
  // public IDs alone revoke nothing: wrong secret is rejected
  // (400 when the cert is already non-Active, 403 when the secret fails)
  const wrongSecret = await post("/api/revocations", {
    certificationId: ids.target, reason: "model-modified", revokerEvaluatorId: ids.evaluator,
    revokerSecret: "wrong",
  });
  assert.ok([400, 403].includes(wrongSecret.status));
  const wasActive = latest.status === "Active";
  const r = await post("/api/revocations", {
    certificationId: ids.target, reason: "model-modified", revokerEvaluatorId: ids.evaluator,
    revokerSecret: ids.evSecret,
  });
  if (!wasActive) {
    // non-active certs refuse revocation — reissue flow covered instead
    assert.equal(r.status, 400);
    const ev = await post("/api/evaluations", {
      modelId: ids.model, datasetId: ids.dataset, evaluatorId: ids.evaluator,
      evaluatorSecret: ids.evSecret,
      metrics: GOOD, thresholds: TH,
    });
    assert.equal(ev.status, 201);
    const cert = await post("/api/certifications/issue", {
      modelId: ids.model, evaluationId: ev.body.evaluation.evaluationId,
    });
    assert.equal(cert.status, 201);
    ids.target = cert.body.certification.certificationId;
    // fresh Active cert: wrong secret must fail closed with 403
    const freshWrong = await post("/api/revocations", {
      certificationId: ids.target, reason: "model-modified", revokerEvaluatorId: ids.evaluator,
      revokerSecret: "wrong",
    });
    assert.equal(freshWrong.status, 403);
    const r2 = await post("/api/revocations", {
      certificationId: ids.target, reason: "model-modified", revokerEvaluatorId: ids.evaluator,
      revokerSecret: ids.evSecret,
    });
    assert.equal(r2.status, 201, JSON.stringify(r2.body));
    assert.equal(r2.body.circuits.length, 2);
  } else {
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.circuits.length, 2);
  }
  const again = await get(`/api/verify/${ids.model}`);
  assert.equal(again.body.bundle.status, "Revoked");
  assert.equal(again.body.bundle.revocationReason, "model-modified");
  assert.equal(again.body.bundle.revoked, true);
  const badges = await get(`/api/certifications/${ids.target}/badges`);
  assert.equal(badges.body.badges.certificationActive, false);
  // revoked certs cannot be revoked twice
  const twice = await post("/api/revocations", {
    certificationId: ids.target, reason: "security-issue", revokerEvaluatorId: ids.evaluator,
    revokerSecret: ids.evSecret,
  });
  assert.equal(twice.status, 400);
});

await test("F13: restore revoked certification (admin-gated, gates re-checked)", async () => {
  const wrongAdmin = await post(`/api/certifications/${ids.target}/restore`, { adminSecret: "wrong" });
  assert.equal(wrongAdmin.status, 403);
  const noAdmin = await post(`/api/certifications/${ids.target}/restore`, {});
  assert.equal(noAdmin.status, 403);
  const r = await post(`/api/certifications/${ids.target}/restore`, { adminSecret: ADMIN });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.certification.status, "Active");
  assert.equal(r.body.circuit.circuit, "restoreCertification");
  assert.equal(r.body.certification.badges.certificationActive, true);
  // restoring an Active cert is refused
  const again = await post(`/api/certifications/${ids.target}/restore`, { adminSecret: ADMIN });
  assert.equal(again.status, 400);
});

await test("F14: dataset expiry keeper route", async () => {
  const ds = await post("/api/datasets/certify", {
    datasetId: `ShortLived-${TAG}`, datasetDescriptor: "short", version: "v1",
    sizeClaim: 1000, qualityClaim: 0.9, consent: true, expiresInDays: -1,
  });
  assert.equal(ds.status, 201);
  const early = await post(`/api/datasets/${ids.dataset}/expire`, {});
  assert.equal(early.status, 400); // main dataset not lapsed
  const done = await post(`/api/datasets/ShortLived-${TAG}/expire`, {});
  assert.equal(done.status, 200);
  assert.equal(done.body.dataset.approvalStatus, "expired");
  assert.equal(done.body.circuit.circuit, "expireDataset");
  const twice = await post(`/api/datasets/ShortLived-${TAG}/expire`, {});
  assert.equal(twice.status, 400);
});

await test("F15: fingerprint-anchored version control", async () => {
  const m = `Anchored-${TAG}`;
  const reg = await post("/api/models", {
    modelId: m, version: "v1", modelContent: "binary-a", category: "other",
    ownerSecret: ids.owner,
  });
  assert.equal(reg.status, 201);
  const ev = await post("/api/evaluations", {
    modelId: m, datasetId: ids.dataset, evaluatorId: ids.evaluator,
    evaluatorSecret: ids.evSecret, metrics: GOOD, thresholds: TH,
  });
  assert.equal(ev.status, 201);
  const cert = await post("/api/certifications/issue", {
    modelId: m, evaluationId: ev.body.evaluation.evaluationId,
  });
  assert.equal(cert.status, 201);
  // same version label, different binary: old evaluation must NOT certify it
  const upd = await post(`/api/models/${m}/version`, {
    newVersion: "v1", modelContent: "binary-b", ownerSecret: ids.owner,
  });
  assert.equal(upd.status, 200);
  assert.deepEqual(upd.body.superseded, [cert.body.certification.certificationId]);
  const stale = await get(`/api/certifications/${cert.body.certification.certificationId}`);
  assert.equal(stale.body.certification.status, "Expired");
  const reissue = await post("/api/certifications/issue", {
    modelId: m, evaluationId: ev.body.evaluation.evaluationId,
  });
  assert.equal(reissue.status, 400);
  assert.match(reissue.body.error, /model version not verified/);
  // no-op updates are refused
  const noop = await post(`/api/models/${m}/version`, {
    newVersion: "v1", modelContent: "binary-b", ownerSecret: ids.owner,
  });
  assert.equal(noop.status, 400);
});

await test("F16: recertification supersedes the previous Active seal", async () => {
  const m = `Recert-${TAG}`;
  await post("/api/models", {
    modelId: m, version: "v1", modelContent: "r1", category: "other",
    ownerSecret: ids.owner,
  });
  const mkEval = async () => (await post("/api/evaluations", {
    modelId: m, datasetId: ids.dataset, evaluatorId: ids.evaluator,
    evaluatorSecret: ids.evSecret, metrics: GOOD, thresholds: TH,
  })).body.evaluation.evaluationId;
  const first = await post("/api/certifications/issue", { modelId: m, evaluationId: await mkEval() });
  assert.equal(first.status, 201);
  const second = await post("/api/certifications/issue", { modelId: m, evaluationId: await mkEval() });
  assert.equal(second.status, 201);
  assert.ok((second.body.circuits ?? []).some((c) => c.circuit === "markSuperseded"));
  const old = await get(`/api/certifications/${first.body.certification.certificationId}`);
  assert.equal(old.body.certification.status, "Expired");
  const bundle = await get(`/api/verify/${m}`);
  assert.equal(bundle.body.bundle.status, "Active");
});
