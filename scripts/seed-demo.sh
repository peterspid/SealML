#!/usr/bin/env bash
# SealML demo seed — the complete registry flow end to end:
# register -> dataset -> evaluator -> evaluate -> issue -> verify.
# Idempotent: skips steps that already exist. Requires the backend running.
set -u
BASE="${BASE_URL:-http://127.0.0.1:3000}"

post() { curl -s -X POST "$BASE$1" -H 'Content-Type: application/json' -d "$2"; }
get() { curl -s "$BASE$1"; }

echo "== health =="
get /api/health; echo

if ! get /api/models/FraudDetector-v1 | grep -q '"modelId"'; then
  echo "== register model =="
  post /api/models '{"modelId":"FraudDetector-v1","name":"FraudDetector","version":"v1","modelContent":"demo-fraud-model-weights-v1","category":"fraud-detection","developer":"Acme AI","description":"Flags suspicious card transactions","ownerSecret":"demo-owner"}' | head -c 200; echo
else
  echo "(model exists, skipping)"
fi

if ! get /api/datasets/FraudDataset-v3 | grep -q '"datasetId"'; then
  echo "== certify dataset =="
  post /api/datasets/certify '{"datasetId":"FraudDataset-v3","datasetDescriptor":"approved-export-manifest-2026-09","version":"v3","sizeClaim":100000,"qualityClaim":0.95,"source":"Certified financial institution","categories":["fraud","payments"],"consent":true}' | head -c 200; echo
else
  echo "(dataset exists, skipping)"
fi

if ! get /api/evaluators/demo-university | grep -q '"evaluatorId"'; then
  echo "== register evaluator =="
  post /api/evaluators '{"evaluatorId":"demo-university","organization":"Northbridge University AI Lab","role":"university"}' | head -c 200; echo
else
  echo "(evaluator exists, skipping)"
fi

echo "== evaluate =="
EV=$(post /api/evaluations '{"modelId":"FraudDetector-v1","datasetId":"FraudDataset-v3","evaluatorId":"demo-university","evaluatorSecret":"demo-university","metrics":{"accuracy":0.93,"precision":0.91,"recall":0.88,"error-rate":0.07,"samplesEvaluated":100000},"thresholds":{"accuracy":0.9,"precision":0.85,"recall":0.8,"error-rate":0.1,"minSamples":50000},"fairness":{"metric":"group-error-rate-delta","groups":["retail","corporate"],"delta":0.03,"threshold":0.05,"conditions":"groups=retail,corporate; max pairwise error-rate difference"}}')
echo "$EV" | head -c 300; echo
EVID=$(echo "$EV" | python3 -c "import json,sys; print(json.load(sys.stdin)['evaluation']['evaluationId'])" 2>/dev/null || true)

if [ -n "${EVID:-}" ]; then
  echo "== issue certification =="
  post /api/certifications/issue "{\"modelId\":\"FraudDetector-v1\",\"evaluationId\":\"$EVID\"}" | head -c 300; echo
fi

echo "== verify =="
get /api/verify/FraudDetector-v1 | python3 -c "import json,sys; b=json.load(sys.stdin)['bundle']; print({k:b[k] for k in ('modelId','version','status','evaluatorAuthorized','revoked')})"
echo "Done. Open $BASE in a browser."
