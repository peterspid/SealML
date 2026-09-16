import { promises as fs } from "node:fs";
import path from "node:path";
import { copyFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { chainMode, config } from "./config";
import { governorCommitment } from "./midnight";
import type { CircuitCall, ContractName } from "./midnight";
import { HttpError } from "./store";

interface ArgSpec {
  name: string;
  kind: "bytes" | "opaque" | "uint" | "bool";
}

const specCache = new Map<string, ArgSpec[]>();

// Argument order and ABI types come from the compiler output — never
// hardcoded per circuit. Bytes<32> arrive as hex and convert to Uint8Array,
// Uint<64> numbers convert to bigint, matching the generated bindings.
async function argSpecs(
  contract: ContractName,
  circuit: string,
): Promise<ArgSpec[]> {
  const key = `${contract}.${circuit}`;
  const hit = specCache.get(key);
  if (hit) return hit;
  const infoRaw = await fs.readFile(
    path.join(process.cwd(), "contracts", "build", contract, "compiler", "contract-info.json"),
    "utf8",
  );
  const info = JSON.parse(infoRaw);
  const found = (info.circuits as Array<{ name: string; arguments: Array<{ name: string; type: { "type-name": string } }> }>).find(
    (c) => c.name === circuit,
  );
  if (!found) throw new HttpError(500, `unknown circuit ${key}`);
  const specs = found.arguments.map((a) => ({
    name: a.name,
    kind:
      a.type["type-name"] === "Bytes"
        ? ("bytes" as const)
        : a.type["type-name"] === "Opaque"
          ? ("opaque" as const)
          : a.type["type-name"] === "Boolean"
            ? ("bool" as const)
            : ("uint" as const),
  }));
  specCache.set(key, specs);
  return specs;
}

function convert(
  specs: ArgSpec[],
  args: Record<string, string | number | boolean>,
): unknown[] {
  return specs.map((s) => {
    const v = args[s.name];
    if (v === undefined) throw new HttpError(500, `missing arg ${s.name}`);
    if (s.kind === "bytes") {
      if (typeof v !== "string" || !/^[0-9a-fA-F]+$/.test(v) || v.length % 2 !== 0)
        throw new HttpError(500, `arg ${s.name} must be hex`);
      return Buffer.from(v, "hex");
    }
    if (s.kind === "uint") {
      if (typeof v === "boolean" || !Number.isFinite(Number(v)))
        throw new HttpError(500, `arg ${s.name} must be numeric`);
      return BigInt(Math.floor(Number(v)));
    }
    if (s.kind === "bool") return Boolean(v);
    return String(v);
  });
}

async function loadBundle(buildDir: string): Promise<{ Contract: new (...a: unknown[]) => unknown }> {
  const src = path.join(buildDir, "contract", "index.js");
  const dst = path.join(buildDir, "contract", "index.mjs");
  await copyFile(src, dst);
  return import(pathToFileURL(dst).href) as Promise<{ Contract: new (...a: unknown[]) => unknown }>;
}

interface Providers {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [k: string]: any;
}

// Dynamic ESM imports via a runtime string so tsc (CommonJS, node10
// resolution) never tries to resolve the SDK's export maps statically.
// Everything crossing this boundary is `any` by design; the arg-spec
// table from the compiler output is what keeps calls honest.
function dyn(spec: string): Promise<any> {
  return new Function("s", "return import(s)")(spec) as Promise<any>;
}

let providersCache: Providers | null = null;

async function providers(): Promise<Providers> {
  if (providersCache) return providersCache;
  if (!config.walletSeed) throw new HttpError(502, "preprod wallet not configured");
  const { setNetworkId } = await dyn("@midnight-ntwrk/midnight-js/network-id");
  setNetworkId(config.networkId);
  const { WalletBuilder } = await dyn("@midnight-ntwrk/wallet");
  const { firstValueFrom } = await dyn("rxjs");
  const { httpClientProofProvider } = await dyn(
    "@midnight-ntwrk/midnight-js-http-client-proof-provider"
  );
  const { indexerPublicDataProvider } = await dyn(
    "@midnight-ntwrk/midnight-js-indexer-public-data-provider"
  );
  const { levelPrivateStateProvider } = await dyn(
    "@midnight-ntwrk/midnight-js-level-private-state-provider"
  );
  const indexerWs = process.env.MIDNIGHT_INDEXER_WS_URL ?? config.indexerUrl.replace(/^http/, "ws");
  const wallet = await WalletBuilder.buildFromSeed(
    config.indexerUrl,
    indexerWs,
    config.proofServerUrl,
    config.nodeUrl,
    config.walletSeed,
    config.networkId,
  );
  wallet.start();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const state = (await firstValueFrom((wallet as any).state())) as {
    coinPublicKey: unknown;
    encryptionPublicKey: unknown;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = wallet as any;
  providersCache = {
    wallet,
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: "sealml-operate",
      privateStoragePasswordProvider: () =>
        Promise.resolve(process.env.PRIVATE_STATE_PASSWORD ?? "sealml-local-state"),
      accountId: process.env.PRIVATE_STATE_ACCOUNT_ID ?? "sealml",
    }),
    publicDataProvider: indexerPublicDataProvider(config.indexerUrl, indexerWs),
    // zkConfigProvider is per-contract and attached by submitCall below.
    proofBase: httpClientProofProvider,
    walletProvider: {
      coinPublicKey: state.coinPublicKey,
      encryptionPublicKey: state.encryptionPublicKey,
      balanceTx: (tx: unknown, newCoins: unknown) => w.balanceTransaction(tx, newCoins),
    },
    midnightProvider: {
      submitTx: (tx: unknown) => w.submitTransaction(tx),
    },
  };
  return providersCache;
}

async function zkConfigProviderFor(buildDir: string): Promise<unknown> {
  const { ZKConfigProvider, createZKIR, createProverKey, createVerifierKey } =
    await dyn("@midnight-ntwrk/midnight-js/types");
  const zkirDir = path.join(buildDir, "zkir");
  const keysDir = path.join(buildDir, "keys");
  return new (class extends (ZKConfigProvider as new () => {
    getZKIR(id: string): Promise<unknown>;
    getProverKey(id: string): Promise<unknown>;
    getVerifierKey(id: string): Promise<unknown>;
  }) {
    async getZKIR(id: string) {
      return createZKIR(await fs.readFile(path.join(zkirDir, `${id}.bzkir`)));
    }
    async getProverKey(id: string) {
      return createProverKey(await fs.readFile(path.join(keysDir, `${id}.prover`)));
    }
    async getVerifierKey(id: string) {
      return createVerifierKey(await fs.readFile(path.join(keysDir, `${id}.verifier`)));
    }
  })();
}

// Submit a circuit call to the deployed registry and return the
// transaction id. In local-mirror mode there is no chain to write to,
// so this records nothing and returns null — callers store that honestly.
export async function anchor(call: CircuitCall): Promise<string | null> {
  if (chainMode() !== "preprod" || !call.address) return null;
  try {
    const p = await providers();
    const buildDir = path.join(process.cwd(), "contracts", "build", call.contract);
    const bundle = await loadBundle(buildDir);
    const { CompiledContract } = await dyn(
      "@midnight-ntwrk/midnight-js-protocol/compact-js"
    );
    const { pipe } = await dyn("effect");
    const { createCircuitCallTxInterface } = await dyn(
      "@midnight-ntwrk/midnight-js/contracts"
    );
    const compiledContract = pipe(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (CompiledContract as any).make(call.contract, (bundle as any).Contract),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (CompiledContract as any).withCompiledFileAssets(buildDir),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (CompiledContract as any).withVacantWitnesses,
    );
    const zkConfigProvider = await zkConfigProviderFor(buildDir);
    const full = {
      ...p,
      zkConfigProvider,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      proofProvider: (p.proofBase as any)(config.proofServerUrl, zkConfigProvider),
    };
    const callTx = createCircuitCallTxInterface(
      full,
      compiledContract,
      call.address,
      undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ) as any;
    const specs = await argSpecs(call.contract, call.circuit);
    const ordered = convert(specs, call.args);
    const result = await callTx[call.circuit](...ordered);
    return String(result.public.txId);
  } catch (e) {
    throw new HttpError(
      502,
      `preprod submission failed (${call.contract}.${call.circuit}): ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

export function governorAuthority(): string {
  return governorCommitment(config.adminSecret);
}
