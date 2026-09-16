// SealML preprod deploy — deploys the six Compact registries to Midnight
// preprod, verifies each on-chain, writes data/addresses.json.
//
// Prerequisites:
//   1. npm run compile:contracts
//   2. cp .env.example .env.preprod  -> set WALLET_SEED (funded with tNIGHT
//      + DUST from the preprod faucet). Never commit this file.
//   3. A proof server on MIDNIGHT_PROOF_SERVER_URL (default :6300).
//
// Usage: npm run deploy:preprod
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { config as dotenv } from "dotenv";

dotenv({ path: ".env.preprod" });
dotenv();

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const ORDER = [
  "EvaluatorRegistry",
  "ModelRegistry",
  "DatasetRegistry",
  "EvaluationRegistry",
  "CertificationRegistry",
  "RevocationRegistry",
];

function env(name, fallback) {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === "") {
    console.error(`Missing ${name}. Copy .env.example to .env.preprod and fill it in.`);
    process.exit(1);
  }
  return v;
}

// The compiler emits an ESM bundle as index.js inside a CommonJS package,
// which Node refuses to load directly. Import a generated .mjs copy.
async function loadBundle(buildDir) {
  const src = path.join(buildDir, "contract", "index.js");
  const dst = path.join(buildDir, "contract", "index.mjs");
  await copyFile(src, dst);
  return import(pathToFileURL(dst).href);
}

async function main() {
  const seed = env("WALLET_SEED");
  // Same secret the backend gates privileged API calls with; its
  // commitment becomes the on-chain governor of the three registries.
  const adminSecret = env("ADMIN_SECRET", "sealml-local-admin");
  const governor = createHash("sha256").update(`governor:${adminSecret}`).digest();
  const networkId = process.env.MIDNIGHT_NETWORK_ID ?? "preprod";
  const nodeUrl = env("MIDNIGHT_NODE_URL", "https://rpc.preprod.midnight.network");
  const indexerUrl = env("MIDNIGHT_INDEXER_URL", "https://indexer.preprod.midnight.network");
  const indexerWsUrl =
    process.env.MIDNIGHT_INDEXER_WS_URL ?? indexerUrl.replace(/^http/, "ws");
  const proofServerUrl =
    process.env.MIDNIGHT_PROOF_SERVER_URL ?? "http://127.0.0.1:6300";

  const { setNetworkId, getNetworkId } = await import(
    "@midnight-ntwrk/midnight-js/network-id"
  );
  setNetworkId(networkId);
  console.log(`network: ${getNetworkId()}`);

  try {
    await fetch(proofServerUrl.replace(/\/$/, "") + "/");
  } catch {
    console.error(
      `Proof server unreachable at ${proofServerUrl}. Start it first (see Midnight docs), then re-run.`,
    );
    process.exit(1);
  }

  const { WalletBuilder } = await import("@midnight-ntwrk/wallet");
  const { firstValueFrom } = await import("rxjs");
  const { ZKConfigProvider, createZKIR, createProverKey, createVerifierKey } =
    await import("@midnight-ntwrk/midnight-js/types");
  const { deployContract, findDeployedContract } = await import(
    "@midnight-ntwrk/midnight-js/contracts"
  );
  const { httpClientProofProvider } = await import(
    "@midnight-ntwrk/midnight-js-http-client-proof-provider"
  );
  const { indexerPublicDataProvider } = await import(
    "@midnight-ntwrk/midnight-js-indexer-public-data-provider"
  );
  const { levelPrivateStateProvider } = await import(
    "@midnight-ntwrk/midnight-js-level-private-state-provider"
  );
  const { CompiledContract } = await import(
    "@midnight-ntwrk/midnight-js-protocol/compact-js"
  );
  const { pipe } = await import("effect");

  console.log("starting wallet (first sync can take a while) ...");
  const wallet = await WalletBuilder.buildFromSeed(
    indexerUrl,
    indexerWsUrl,
    proofServerUrl,
    nodeUrl,
    seed,
    networkId,
  );
  wallet.start();
  const state = await firstValueFrom(wallet.state());
  const balances = state?.balances ?? {};
  console.log(`wallet synced. balances: ${JSON.stringify(balances)}`);
  const funded = Object.values(balances).some((b) => {
    try {
      return BigInt(String(b)) > 0n;
    } catch {
      return false;
    }
  });
  if (!funded) {
    console.error(
      "Wallet has no funds. Request tNIGHT + DUST from the preprod faucet, wait for sync, then re-run.",
    );
    await wallet.close?.();
    process.exit(1);
  }

  const walletProvider = {
    coinPublicKey: state.coinPublicKey,
    encryptionPublicKey: state.encryptionPublicKey,
    balanceTx: (tx, newCoins) => wallet.balanceTransaction(tx, newCoins),
  };
  const midnightProvider = {
    submitTx: (tx) => wallet.submitTransaction(tx),
  };

  const addresses = {};
  for (const name of ORDER) {
    const buildDir = path.join(ROOT, "contracts", "build", name);
    const bundle = await loadBundle(buildDir);
    const compiledContract = pipe(
      CompiledContract.make(name, bundle.Contract),
      CompiledContract.withCompiledFileAssets(buildDir),
      CompiledContract.withVacantWitnesses,
    );
    const zkirDir = path.join(buildDir, "zkir");
    const keysDir = path.join(buildDir, "keys");
    const zkConfigProvider = new (class extends ZKConfigProvider {
      async getZKIR(id) {
        return createZKIR(await readFile(path.join(zkirDir, `${id}.bzkir`)));
      }
      async getProverKey(id) {
        return createProverKey(await readFile(path.join(keysDir, `${id}.prover`)));
      }
      async getVerifierKey(id) {
        return createVerifierKey(await readFile(path.join(keysDir, `${id}.verifier`)));
      }
    })();
    const { createCircuitCallTxInterface } = await import(
      "@midnight-ntwrk/midnight-js/contracts"
    );
    const providers = {
      privateStateProvider: levelPrivateStateProvider({
        privateStateStoreName: `sealml-${name.toLowerCase()}`,
        privateStoragePasswordProvider: () =>
          Promise.resolve(process.env.PRIVATE_STATE_PASSWORD ?? "sealml-local-state"),
        accountId: process.env.PRIVATE_STATE_ACCOUNT_ID ?? "sealml",
      }),
      publicDataProvider: indexerPublicDataProvider(indexerUrl, indexerWsUrl),
      zkConfigProvider,
      proofProvider: httpClientProofProvider(proofServerUrl, zkConfigProvider),
      walletProvider,
      midnightProvider,
    };
    console.log(`deploying ${name} ...`);
    const deployed = await deployContract(providers, { compiledContract });
    const address = String(deployed.deployTxData.public.contractAddress);
    console.log(`${name} -> ${address}`);
    const found = await findDeployedContract(providers, {
      compiledContract,
      contractAddress: address,
    });
    if (!found) throw new Error(`${name}: not found on-chain after deploy`);
    // Initialize the governor on registries that have privileged circuits,
    // so backend-authorized calls satisfy the on-chain authority asserts.
    if (["EvaluatorRegistry", "DatasetRegistry", "CertificationRegistry"].includes(name)) {
      const callTx = createCircuitCallTxInterface(
        providers,
        compiledContract,
        address,
        undefined,
      );
      await callTx.initGovernor(governor);
      console.log(`${name}: governor initialized`);
    }
    addresses[
      `${name.replace(/([A-Z])/g, "_$1").toUpperCase().replace(/^_/, "")}_ADDRESS`
    ] = address;
  }

  await mkdir(path.join(ROOT, "data"), { recursive: true });
  const outFile = path.join(ROOT, "data", "addresses.json");
  await writeFile(outFile, JSON.stringify(addresses, null, 2), "utf8");
  console.log(`verified on-chain. addresses written to ${outFile}`);
  console.log("Restart the backend (npm start) to serve in preprod mode.");
  await wallet.close?.();
  process.exit(0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
