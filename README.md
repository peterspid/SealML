# SealML

SealML is a privacy-preserving certification registry for AI models. It lets a developer register a model fingerprint, an authorized evaluator attest to private evaluation results, and a verifier check the resulting time-bound seal without receiving the model weights, dataset rows, or individual predictions.

The public record contains commitments, policy thresholds, claim results, status changes, expiries, and (when configured) Midnight transaction IDs. The private inputs stay with the people who already have the right to handle them.

## What the app does

- Registers model identities from a SHA-256 fingerprint or model content.
- Enforces owner commitments for model version changes and deactivation.
- Certifies dataset commitments with consent, quality, sample-count, approval, and expiry metadata.
- Registers evaluators and gates evaluation/revocation actions on evaluator credentials.
- Stores metric and fairness attestations with the policy thresholds used for the run.
- Issues one active, time-bound certification seal per model fingerprint.
- Supports expiry, revocation, restoration, and automatic superseding when a model fingerprint changes.
- Provides a public verification bundle, selective disclosure, and browser-local file integrity checks.
- Shows the exact Compact circuit payload for each state-changing action.
- Runs in local-mirror mode offline, or anchors mutations to six Midnight preprod registries when deployed.

## Product flow

```
Register model → Certify dataset → Submit evaluation → Issue seal → Verify publicly
```

The evaluation engine can run a private CSV-based metric calculation and submit only the resulting claims and proof commitment:

```bash
python evaluation-engine/run_evaluation.py \
  --api http://127.0.0.1:3000 \
  --model FraudDetector-v1 \
  --dataset FraudDataset-v3 \
  --evaluator demo-university \
  --secret demo-university \
  --csv evaluation-engine/sample-preds.csv
```

Metrics are currently self-reported attestations. SealML checks authorization, claim linkage, thresholds, and circuit payloads; it does not re-run a large private model evaluation on-chain.

## Repository map

```
contracts/            Compact source, compiler output, ZKIR, and prover/verifier keys
backend/src/          Express API, validation, persistence, chain payloads, and Midnight client
frontend/dist/        Static landing page and workspace UI
shared/               Shared types and chain enum codes
evaluation-engine/    Private metric aggregation and commitment helpers
test/                 API end-to-end tests and Python-engine tests
scripts/              Contract compilation, demo seeding, and preprod deployment
api/                  Vercel catch-all serverless entrypoint
vercel.json           Vercel build and function configuration
data/                 Local ledger mirror; address state is generated and ignored
```

## Run locally

Requires Node.js 20+ and Python 3.10+ for the evaluation engine.

```bash
npm install
npm run compile:contracts   # optional for local mirror; required for chain writes
npm run build
npm start
```

Open <http://localhost:3000>. The landing page is at `/#/`; the operational workspace is at `/#/dashboard`.

Useful checks:

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/chain/status
npm test
```

The API end-to-end tests run against a live backend, so keep `npm start` running in another terminal and then run `npm test`. Each run uses unique IDs, so reruns never collide with stored state. The suite covers the API lifecycle from registration through verification, expiry, revocation, restoration, and recertification. Re-seed the demo afterward if you want the dashboard populated:

```bash
bash scripts/seed-demo.sh
```

On Windows, use Git Bash or WSL for the `.sh` helpers. PowerShell users can run the Node commands directly.

## Midnight preprod

Local mirror mode is the default when the wallet or all six deployed addresses are missing. It deliberately keeps the same validation and circuit payloads, but returns `chainTx: null` and does not claim that a write reached Midnight.

To anchor real writes:

1. Copy `.env.example` to `.env.preprod`.
2. Set a strong `ADMIN_SECRET`, a funded `WALLET_SEED`, and the preprod endpoints.
3. Start the Midnight proof server.
4. Run `npm run compile:contracts`.
5. Run `npm run deploy:preprod`; this deploys Model, Dataset, Evaluator, Evaluation, Certification, and Revocation registries and writes `data/addresses.json`.
6. Restart the API and confirm `GET /api/chain/status` reports `mode: "preprod"`.
7. Submit a small test flow and confirm the returned `chainTx` values are real transaction IDs.

### Browser-wallet deployment

The Chain page also supports the Midnight dApp connector used by Lace/compatible wallets:

1. Install and unlock a compatible Midnight browser wallet on the `preprod` network.
2. Open the deployed app, choose **Chain**, and click **Connect Midnight wallet**.
3. Enter the same `ADMIN_SECRET` configured for the API. It is hashed in the browser to initialize the three privileged governors and is never sent to SealML.
4. Click **Deploy six registries with wallet** and approve the deployment/governor transactions in the wallet.

The browser path deploys, verifies, and stores all six addresses in the current browser. It does not expose wallet keys. To make the API write against those addresses, run the operator deployment path (which records `data/addresses.json`) or add the resulting addresses as server environment variables; Vercel's `/tmp` filesystem is not durable.

Never commit `.env.preprod`, wallet seeds, private-state passwords, or admin secrets. Treat the default local admin secret as development-only.

## Vercel deployment

The repo includes a Vercel configuration and a catch-all API function:

```bash
npx vercel --prod
```

Vercel serves the static frontend from `frontend/dist` and routes `/api/*` to the Express function. Set the public runtime variables in the Vercel project settings before deploying.

Important production constraint: the local JSON ledger is not a durable database in a serverless environment. On Vercel, it uses `/tmp` and is suitable for a preview/demo or for read/write flows backed by configured chain state, but it must be replaced with a durable store and/or chain-indexer read model before treating a Vercel deployment as the production source of truth. The terminal `deploy:preprod` job is long-running and should run from an operator host; the browser-wallet deployment runs in the user's browser and can be started from Vercel.

This workspace currently has no wallet seed or deployed registry addresses, so it can be verified locally in mirror mode. A real Midnight preprod deployment must be run by an operator who can fund the wallet and add those secrets.

## Security and trust model

- Model owners prove control with a secret commitment; public model IDs do not authorize version changes.
- Evaluators prove identity with a credential secret on every evaluation and revocation.
- Admin-only actions use `ADMIN_SECRET`, whose commitment is also the Compact governor.
- Expiry keepers are permissionless but the timestamp is checked by the validation and circuit payload.
- A changed fingerprint automatically retires prior active certifications for that model.
- Raw datasets, model weights, and predictions are never persisted by the API.
- State-changing API calls have a small in-memory rate limit; use a gateway and durable rate limiting for a shared production deployment.

## Honest limitations and next steps

SealML proves identity and preserves an auditable claim trail; a model hash alone does not prove quality. The current evaluator flow records authorized attestations, not a zero-knowledge proof of inference. A production rollout should add a durable database, managed secrets, HTTPS and origin controls, observability, a chain-indexer reconciliation job, and a cryptographic proof provider for private evaluation claims.

The UI intentionally exposes local-mirror versus preprod status, circuit names, expiry, revocation, and limitations so operators and verifiers can tell exactly what has been proven.
