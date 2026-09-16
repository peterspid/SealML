import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: ".env.preprod" });
dotenv.config();

export interface AppConfig {
  port: number;
  networkId: string;
  nodeUrl: string;
  indexerUrl: string;
  proofServerUrl: string;
  walletSeed: string | null;
  // Backend API gate for privileged calls (authorize, approval, restore).
  // Its sha256 commitment is also the on-chain governor, initialized by
  // the deploy script. Default is local-dev only — never use in production.
  adminSecret: string;
  addresses: Record<string, string>;
  ledgerFile: string;
  certDefaultDays: number;
}

function loadAddresses(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of [
    "MODEL_REGISTRY_ADDRESS",
    "DATASET_REGISTRY_ADDRESS",
    "EVALUATOR_REGISTRY_ADDRESS",
    "EVALUATION_REGISTRY_ADDRESS",
    "CERTIFICATION_REGISTRY_ADDRESS",
    "REVOCATION_REGISTRY_ADDRESS",
  ]) {
    if (process.env[k]) out[k] = String(process.env[k]);
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const saved = require("../../data/addresses.json");
    for (const [k, v] of Object.entries(saved)) {
      if (typeof v === "string" && v && !(k in out)) out[k] = v;
    }
  } catch {
    /* no saved addresses yet */
  }
  return out;
}

export const config: AppConfig = {
  port: Number(process.env.PORT ?? 3000),
  networkId: process.env.MIDNIGHT_NETWORK_ID ?? "preprod",
  nodeUrl: process.env.MIDNIGHT_NODE_URL ?? "https://rpc.preprod.midnight.network",
  indexerUrl:
    process.env.MIDNIGHT_INDEXER_URL ?? "https://indexer.preprod.midnight.network",
  proofServerUrl:
    process.env.MIDNIGHT_PROOF_SERVER_URL ?? "http://127.0.0.1:6300",
  walletSeed: process.env.WALLET_SEED ?? null,
  adminSecret: (() => {
    const s = process.env.ADMIN_SECRET;
    if (!s) {
      console.warn(
        "[sealml] ADMIN_SECRET unset — using the local-dev default. " +
          "Set a strong ADMIN_SECRET (and redeploy governors) before any shared use.",
      );
      return "sealml-local-admin";
    }
    return s;
  })(),
  addresses: loadAddresses(),
  ledgerFile:
    process.env.LEDGER_FILE ??
    (process.env.VERCEL === "1"
      ? path.join("/tmp", "sealml-ledger.json")
      : path.join(process.cwd(), "data", "ledger.json")),
  certDefaultDays: (() => {
    const n = Number(process.env.CERT_DEFAULT_DAYS ?? 90);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 90;
  })(),
};

export function reloadAddresses(): Record<string, string> {
  const fresh = loadAddresses();
  for (const k of Object.keys(config.addresses)) delete config.addresses[k];
  Object.assign(config.addresses, fresh);
  return config.addresses;
}

export function chainMode(): "preprod" | "local-mirror" {
  const needed = [
    "MODEL_REGISTRY_ADDRESS",
    "DATASET_REGISTRY_ADDRESS",
    "EVALUATOR_REGISTRY_ADDRESS",
    "EVALUATION_REGISTRY_ADDRESS",
    "CERTIFICATION_REGISTRY_ADDRESS",
    "REVOCATION_REGISTRY_ADDRESS",
  ];
  const ready = needed.every((k) => config.addresses[k]) && !!config.walletSeed;
  return ready ? "preprod" : "local-mirror";
}
