// SealML evaluation-engine tests: metrics math on the sample CSV and the
// attestation guard that refuses raw-data fields. Runs: python3 runner.
import { test } from "node:test";
import assert from "node:assert";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ENGINE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "evaluation-engine",
);

function run(args, cwd) {
  return execFileSync("python3", args, { cwd: cwd ?? ENGINE, encoding: "utf8" });
}

await test("engine: sample CSV produces exact aggregate metrics", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "sealml-"));
  const model = path.join(dir, "model.bin");
  await import("node:fs/promises").then((fs) => fs.writeFile(model, "demo-bytes"));
  const out = path.join(dir, "att.json");
  const stdout = run([
    "run_evaluation.py",
    "--model-file",
    model,
    "--test-csv",
    "sample-preds.csv",
    "--model-id",
    "m",
    "--dataset-id",
    "d",
    "--evaluator-id",
    "e",
    "--thresholds",
    '{"accuracy":0.5,"precision":0.5,"recall":0.5,"error-rate":0.6,"minSamples":5}',
    "--fairness-threshold",
    "0.5",
    "--out",
    out,
  ]);
  const metricsLine = stdout.split("\n").find((l) => l.startsWith("metrics="));
  const metrics = JSON.parse(metricsLine.slice("metrics=".length));
  assert.equal(metrics.accuracy, 0.8);
  assert.equal(metrics.samplesEvaluated, 10);
  const att = JSON.parse(readFileSync(out, "utf8"));
  assert.match(att.proofCommitment, /^[0-9a-f]{64}$/);
  assert.ok(!("predictions" in att.claims));
  assert.equal(att.claims.fairness.delta, 0);
});

await test("engine: commitments refuse raw-data fields", async () => {
  const code = [
    "from commitments import build_attestation",
    "try:",
    "    build_attestation({'predictions': [1, 2, 3]})",
    "    print('NOT-RAISED')",
    "except ValueError as e:",
    "    print('RAISED')",
  ].join("\n");
  const out = execFileSync("python3", ["-c", code], { cwd: ENGINE, encoding: "utf8" });
  assert.match(out, /RAISED/);
});
