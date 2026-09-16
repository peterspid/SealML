// Browser wallet deployer — deploys the six SealML registries from the
// user's own wallet and reports each contract address back to the UI.
import { deployContract, findDeployedContract, createCircuitCallTxInterface } from "@midnight-ntwrk/midnight-js/contracts";
import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";
import { FetchZkConfigProvider } from "@midnight-ntwrk/midnight-js-fetch-zk-config-provider";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { Transaction } from "@midnight-ntwrk/ledger-v8";
import { pipe } from "effect";

import * as EvaluatorRegistry from "../contracts/build/EvaluatorRegistry/contract/index.js";
import * as ModelRegistry from "../contracts/build/ModelRegistry/contract/index.js";
import * as DatasetRegistry from "../contracts/build/DatasetRegistry/contract/index.js";
import * as EvaluationRegistry from "../contracts/build/EvaluationRegistry/contract/index.js";
import * as CertificationRegistry from "../contracts/build/CertificationRegistry/contract/index.js";
import * as RevocationRegistry from "../contracts/build/RevocationRegistry/contract/index.js";

const NETWORK_ID = "preprod";
const ORDER = [
  ["EvaluatorRegistry", EvaluatorRegistry],
  ["ModelRegistry", ModelRegistry],
  ["DatasetRegistry", DatasetRegistry],
  ["EvaluationRegistry", EvaluationRegistry],
  ["CertificationRegistry", CertificationRegistry],
  ["RevocationRegistry", RevocationRegistry],
];
const PRIVILEGED = new Set(["EvaluatorRegistry", "DatasetRegistry", "CertificationRegistry"]);
const STORAGE_KEY = "sealml.walletAddresses";

let selectedInitialApi = null;
let connectedApi = null;

function getInitialApis() {
  const midnight = window.midnight;
  if (!midnight || typeof midnight !== "object") return [];
  return Object.values(midnight).filter((candidate) =>
    candidate && typeof candidate === "object" &&
    typeof candidate.name === "string" &&
    typeof candidate.apiVersion === "string" &&
    typeof candidate.connect === "function" &&
    /^4\./.test(candidate.apiVersion),
  );
}

function findApis() {
  const apis = getInitialApis();
  if (!selectedInitialApi || !apis.includes(selectedInitialApi)) selectedInitialApi = apis[0] ?? null;
  return apis;
}

function hexToBytes(hex) {
  const clean = String(hex || "").replace(/^0x/, "");
  if (!clean || clean.length % 2) throw new Error("Wallet returned an invalid public key");
  return new Uint8Array(clean.match(/.{1,2}/g).map((part) => Number.parseInt(part, 16)));
}

function bytesToHex(bytes) {
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function keyFor(value) {
  if (typeof value === "string") return value;
  if (value instanceof Uint8Array) return bytesToHex(value);
  return JSON.stringify(value);
}

function memoryPrivateStateProvider() {
  const states = new Map();
  const signingKeys = new Map();
  let contractAddress = null;
  return {
    setContractAddress(address) { contractAddress = keyFor(address); },
    async set(id, state) { states.set(`${contractAddress}:${keyFor(id)}`, state); },
    async get(id) { return states.get(`${contractAddress}:${keyFor(id)}`) ?? null; },
    async remove(id) { states.delete(`${contractAddress}:${keyFor(id)}`); },
    async clear() { states.clear(); },
    async setSigningKey(address, signingKey) { signingKeys.set(keyFor(address), signingKey); },
    async getSigningKey(address) { return signingKeys.get(keyFor(address)) ?? null; },
    async removeSigningKey(address) { signingKeys.delete(keyFor(address)); },
  };
}

function createWalletProviders(api, name, onProgress) {
  return api.getConfiguration().then(async (config) => {
    if (String(config.networkId) !== NETWORK_ID) {
      throw new Error(`Wallet is connected to ${config.networkId}; switch it to ${NETWORK_ID}.`);
    }
    if (!config.proverServerUri) throw new Error("The connected wallet did not provide a proof server URI.");

    const zkConfigProvider = new FetchZkConfigProvider(
      `${window.location.origin}/contract/compiled/${name}`,
      window.fetch.bind(window),
    );
    const rawPublicDataProvider = indexerPublicDataProvider(config.indexerUri, config.indexerWsUri);
    const publicDataProvider = {
      ...rawPublicDataProvider,
      async queryZSwapAndContractState(address, queryConfig) {
        const result = await rawPublicDataProvider.queryZSwapAndContractState(address, queryConfig);
        if (!result) return result;
        const [zswapChainState, contractState, ledgerParameters] = result;
        return [zswapChainState.postBlockUpdate(new Date()), contractState, ledgerParameters];
      },
    };
    const shielded = await api.getShieldedAddresses();
    const coinPublicKey = hexToBytes(shielded.shieldedCoinPublicKey);
    const encryptionPublicKey = hexToBytes(shielded.shieldedEncryptionPublicKey);
    const walletProvider = {
      getCoinPublicKey: () => coinPublicKey,
      getEncryptionPublicKey: () => encryptionPublicKey,
      async balanceTx(tx) {
        onProgress?.({ kind: "wallet", message: `Wallet is balancing ${name} and requesting approval…` });
        const result = await api.balanceUnsealedTransaction(bytesToHex(tx.serialize()));
        return Transaction.deserialize(
          "signature",
          "proof",
          "binding",
          hexToBytes(result.tx),
        );
      },
    };
    const midnightProvider = {
      async submitTx(tx) {
        const serialized = bytesToHex(tx.serialize());
        onProgress?.({ kind: "wallet", message: `Submitting ${name} through the connected wallet…` });
        await api.submitTransaction(serialized);
        return String(tx.identifiers()[0]);
      },
    };
    return {
      privateStateProvider: memoryPrivateStateProvider(),
      publicDataProvider,
      zkConfigProvider,
      proofProvider: httpClientProofProvider(config.proverServerUri, zkConfigProvider),
      walletProvider,
      midnightProvider,
    };
  });
}

function buildCompiledContract(name, bundle) {
  return pipe(
    CompiledContract.make(name, bundle.Contract),
    CompiledContract.withCompiledFileAssets(`${window.location.origin}/contract/compiled/${name}`),
    CompiledContract.withVacantWitnesses,
  );
}

async function governorCommitment(adminSecret) {
  const input = new TextEncoder().encode(`governor:${adminSecret}`);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return new Uint8Array(digest);
}

async function connect(networkId = NETWORK_ID) {
  const apis = findApis();
  if (!selectedInitialApi) throw new Error("No Midnight wallet detected. Install and unlock a Midnight wallet, then refresh.");
  connectedApi = await selectedInitialApi.connect(networkId);
  const status = await connectedApi.getConnectionStatus();
  if (status.status !== "connected" || String(status.networkId) !== networkId) {
    connectedApi = null;
    throw new Error(`Wallet did not connect to ${networkId}.`);
  }
  const address = (await connectedApi.getUnshieldedAddress()).unshieldedAddress;
  return { api: connectedApi, walletName: selectedInitialApi.name, apiVersion: selectedInitialApi.apiVersion, address, available: apis };
}

async function deployAll({ adminSecret, onProgress }) {
  if (!connectedApi) throw new Error("Connect a Midnight wallet first.");
  if (!adminSecret) throw new Error("Enter the admin secret so the three governor registries can be initialized.");
  const governor = await governorCommitment(adminSecret);
  const addresses = {};

  for (const [name, bundle] of ORDER) {
    onProgress?.({ kind: "start", name, message: `Preparing ${name}…` });
    const providers = await createWalletProviders(connectedApi, name, onProgress);
    const compiledContract = buildCompiledContract(name, bundle);
    onProgress?.({ kind: "prove", name, message: `Proving ${name}. Keep the wallet available for its approval.` });
    const deployed = await deployContract(providers, { compiledContract });
    const address = String(deployed.deployTxData.public.contractAddress);
    const found = await findDeployedContract(providers, { compiledContract, contractAddress: address });
    if (!found) throw new Error(`${name} was submitted but could not be verified by the indexer yet.`);
    addresses[`${name.replace(/([A-Z])/g, "_$1").toUpperCase().replace(/^_/, "")}_ADDRESS`] = address;
    onProgress?.({ kind: "deployed", name, address, message: `${name} deployed and verified at ${address}.` });

    if (PRIVILEGED.has(name)) {
      onProgress?.({ kind: "governor", name, message: `Initializing the ${name} governor…` });
      const callTx = createCircuitCallTxInterface(providers, compiledContract, address, undefined);
      await callTx.initGovernor(governor);
      onProgress?.({ kind: "governor-done", name, message: `${name} governor initialized.` });
    }
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(addresses));
  onProgress?.({ kind: "complete", addresses, message: "All six registries are deployed, verified, and initialized." });
  return addresses;
}

function status() {
  const apis = findApis();
  return {
    detected: apis.length > 0,
    wallets: apis.map((api) => ({ name: api.name, apiVersion: api.apiVersion })),
    connected: Boolean(connectedApi),
    walletName: selectedInitialApi?.name ?? null,
  };
}

window.SealMLWallet = { findApis, connect, deployAll, status, get connected() { return connectedApi; } };
window.dispatchEvent(new CustomEvent("sealml-wallet-ready"));
let walletDetectionAttempts = 0;
const walletDetectionTimer = window.setInterval(() => {
  walletDetectionAttempts += 1;
  if (findApis().length > 0) window.dispatchEvent(new CustomEvent("sealml-wallet-ready"));
  if (walletDetectionAttempts >= 40) window.clearInterval(walletDetectionTimer);
}, 500);
