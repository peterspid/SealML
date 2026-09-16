"""Run a private evaluation and emit the claims payload for SealML.

Reads a predictions CSV + a model file, computes aggregate metrics locally,
and writes an attestation JSON containing ONLY claims (thresholds, met
flags, commitments). Optionally POSTs directly to the SealML backend.

Usage:
  python3 run_evaluation.py --model-file model.bin --test-csv preds.csv \\
      --model-id FraudDetector-v1 --dataset-id FraudDataset-v3 \\
      --evaluator-id eval-uni-01 \\
      --thresholds '{"accuracy":0.9,"precision":0.85,"recall":0.8,"error-rate":0.1,"minSamples":50000}' \\
      [--fairness-threshold 0.05 --api http://127.0.0.1:3000 --out attestation.json]
"""
import argparse
import json
import sys
import urllib.request

from metrics import load_counts, compute_metrics, group_error_rates, fairness_delta
from commitments import file_hash, build_attestation


def post_json(url, payload):
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        return json.load(resp)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model-file", required=True)
    ap.add_argument("--test-csv", required=True)
    ap.add_argument("--model-id", required=True)
    ap.add_argument("--dataset-id", required=True)
    ap.add_argument("--evaluator-id", required=True)
    ap.add_argument("--evaluator-secret", default=None,
                    help="evaluator credential secret (defaults to evaluator id, as the API does)")
    ap.add_argument("--thresholds", required=True, help="JSON with accuracy/precision/recall/error-rate/minSamples")
    ap.add_argument("--fairness-threshold", type=float, default=None)
    ap.add_argument("--fairness-metric", default="group-error-rate-delta")
    ap.add_argument("--api", default=None, help="SealML backend base URL (optional POST)")
    ap.add_argument("--out", default="attestation.json")
    args = ap.parse_args()

    thresholds = json.loads(args.thresholds)
    tp, tn, fp, fn, total, groups = load_counts(args.test_csv)
    metrics = compute_metrics(tp, tn, fp, fn)
    model_hash = file_hash(args.model_file)

    claims = {
        "modelId": args.model_id,
        "modelHash": model_hash,
        "datasetId": args.dataset_id,
        "evaluatorId": args.evaluator_id,
        "metrics": metrics,
        "thresholds": thresholds,
    }
    rates = group_error_rates(groups)
    if args.fairness_threshold is not None:
        delta = fairness_delta(rates)
        claims["fairness"] = {
            "metric": args.fairness_metric,
            "groups": sorted(rates),
            "delta": delta,
            "threshold": args.fairness_threshold,
            "conditions": f"groups={','.join(sorted(rates)) or 'none'}; max pairwise error-rate difference",
        }

    attestation = build_attestation(claims)
    with open(args.out, "w") as f:
        json.dump(attestation, f, indent=2)
    print(f"metrics={json.dumps(metrics)}")
    print(f"proofCommitment={attestation['proofCommitment']}")
    print(f"attestation written to {args.out}")

    if args.api:
        body = {
            "modelId": args.model_id,
            "datasetId": args.dataset_id,
            "evaluatorId": args.evaluator_id,
            "evaluatorSecret": args.evaluator_secret or args.evaluator_id,
            "metrics": metrics,
            "thresholds": thresholds,
        }
        if "fairness" in claims:
            f = claims["fairness"]
            body["fairness"] = f
        result = post_json(args.api.rstrip("/") + "/api/evaluations", body)
        print(f"submitted evaluation {result['evaluation']['evaluationId']}")
        print(f"circuit: {result['circuit']['contract']}.{result['circuit']['circuit']}")


if __name__ == "__main__":
    sys.exit(main())
