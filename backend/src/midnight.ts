import { chainMode, config } from "./config";
import { chainKeyHex, sha256Hex } from "./hashing";

// One deployed Compact contract per registry. Addresses come from
// .env.preprod or data/addresses.json (written by npm run deploy:preprod).
// Nothing here is hardcoded: unknown addresses throw.
export const CONTRACTS = {
  ModelRegistry: "MODEL_REGISTRY_ADDRESS",
  DatasetRegistry: "DATASET_REGISTRY_ADDRESS",
  EvaluatorRegistry: "EVALUATOR_REGISTRY_ADDRESS",
  EvaluationRegistry: "EVALUATION_REGISTRY_ADDRESS",
  CertificationRegistry: "CERTIFICATION_REGISTRY_ADDRESS",
  RevocationRegistry: "REVOCATION_REGISTRY_ADDRESS",
} as const;

export type ContractName = keyof typeof CONTRACTS;

export interface CircuitCall {
  contract: ContractName;
  address: string | null;
  circuit: string;
  args: Record<string, string | number | boolean>;
  mode: "preprod" | "local-mirror";
}

function addr(contract: ContractName): string | null {
  return config.addresses[CONTRACTS[contract]] ?? null;
}

function call(
  contract: ContractName,
  circuit: string,
  args: Record<string, string | number | boolean>,
): CircuitCall {
  return { contract, address: addr(contract), circuit, args, mode: chainMode() };
}

// --- Payload builders: exact circuit args for each state transition. ---
// Keys are sha256("<domain>:<id>") hex; hashes are hex; codes come from
// shared/chain-enums.ts. The same builders feed the preprod submitter and
// the local-mirror audit log, so both paths enforce identical shapes.

export const payloads = {
  registerModel(p: {
    modelId: string;
    hash: string;
    version: string;
    category: string;
    ownerCommitment: string;
    registeredAt: number;
  }): CircuitCall {
    return call("ModelRegistry", "registerModel", {
      modelKey: chainKeyHex("model", p.modelId),
      hash: p.hash,
      version: p.version,
      category: p.category,
      ownerCommitment: p.ownerCommitment,
      registeredAt: p.registeredAt,
    });
  },
  updateModelVersion(p: {
    modelId: string;
    newHash: string;
    newVersion: string;
    ownerCommitment: string;
  }): CircuitCall {
    return call("ModelRegistry", "updateModelVersion", {
      modelKey: chainKeyHex("model", p.modelId),
      newHash: p.newHash,
      newVersion: p.newVersion,
      ownerCommitment: p.ownerCommitment,
    });
  },
  deactivateModel(modelId: string, ownerCommitment: string): CircuitCall {
    return call("ModelRegistry", "deactivateModel", {
      modelKey: chainKeyHex("model", modelId),
      ownerCommitment,
    });
  },
  certifyDataset(p: {
    datasetId: string;
    commitment: string;
    version: string;
    sizeClaim: number;
    qualityClaim: number;
    approvedCode: number;
    expiresAt: number;
  }): CircuitCall {
    return call("DatasetRegistry", "certifyDataset", {
      datasetKey: chainKeyHex("dataset", p.datasetId),
      commitment: p.commitment,
      version: p.version,
      sizeClaim: p.sizeClaim,
      qualityClaim: p.qualityClaim,
      approvedCode: p.approvedCode,
      expiresAt: p.expiresAt,
    });
  },
  setDatasetApproval(
    datasetId: string,
    approval: number,
    authority: string,
  ): CircuitCall {
    return call("DatasetRegistry", "setDatasetApproval", {
      datasetKey: chainKeyHex("dataset", datasetId),
      approval,
      authority,
    });
  },
  initGovernor(
    contract: ContractName,
    authority: string,
  ): CircuitCall {
    return call(contract, "initGovernor", { governor: authority });
  },
  expireDataset(datasetId: string, now: number, expiredCode: number): CircuitCall {
    return call("DatasetRegistry", "expireDataset", {
      datasetKey: chainKeyHex("dataset", datasetId),
      now,
      expiredCode,
    });
  },
  registerEvaluator(p: {
    evaluatorId: string;
    role: string;
    org: string;
    credential: string;
    expiresAt: number;
  }): CircuitCall {
    return call("EvaluatorRegistry", "registerEvaluator", {
      evaluatorKey: chainKeyHex("evaluator", p.evaluatorId),
      role: p.role,
      org: p.org,
      credential: p.credential,
      expiresAt: p.expiresAt,
    });
  },
  setEvaluatorAuthorized(
    evaluatorId: string,
    authorized: boolean,
    authority: string,
  ): CircuitCall {
    return call("EvaluatorRegistry", "setEvaluatorAuthorized", {
      evaluatorKey: chainKeyHex("evaluator", evaluatorId),
      authorized,
      authority,
    });
  },
  submitEvaluation(p: {
    evaluationId: string;
    modelId: string;
    datasetId: string;
    evaluatorId: string;
    modelHash: string;
    datasetCommitment: string;
    evaluatorAuthorized: boolean;
    accuracyMet: boolean;
    precisionMet: boolean;
    recallMet: boolean;
    errorMet: boolean;
    minSamples: number;
    samplesEvaluated: number;
    fairnessMet: boolean;
    fairnessDelta: number;
    fairnessThreshold: number;
    fairnessMetric: string;
    proofCommitment: string;
    evalTimestamp: number;
  }): CircuitCall {
    return call("EvaluationRegistry", "submitEvaluation", {
      evaluationKey: chainKeyHex("evaluation", p.evaluationId),
      modelKey: chainKeyHex("model", p.modelId),
      datasetKey: chainKeyHex("dataset", p.datasetId),
      evaluatorKey: chainKeyHex("evaluator", p.evaluatorId),
      modelHash: p.modelHash,
      datasetCommitment: p.datasetCommitment,
      evaluatorAuthorized: p.evaluatorAuthorized,
      accuracyMet: p.accuracyMet,
      precisionMet: p.precisionMet,
      recallMet: p.recallMet,
      errorMet: p.errorMet,
      minSamples: p.minSamples,
      samplesEvaluated: p.samplesEvaluated,
      fairnessMet: p.fairnessMet,
      fairnessDelta: p.fairnessDelta,
      fairnessThreshold: p.fairnessThreshold,
      fairnessMetric: p.fairnessMetric,
      proofCommitment: p.proofCommitment,
      evalTimestamp: p.evalTimestamp,
    });
  },
  issueCertification(p: {
    certificationId: string;
    modelId: string;
    evaluationId: string;
    issuedAt: number;
    expiresAt: number;
    activeCode: number;
    datasetOk: boolean;
    accuracyOk: boolean;
    evaluatorOk: boolean;
    versionOk: boolean;
  }): CircuitCall {
    return call("CertificationRegistry", "issueCertification", {
      certKey: chainKeyHex("certification", p.certificationId),
      modelKey: chainKeyHex("model", p.modelId),
      evaluationKey: chainKeyHex("evaluation", p.evaluationId),
      issuedAt: p.issuedAt,
      expiresAt: p.expiresAt,
      activeCode: p.activeCode,
      datasetOk: p.datasetOk,
      accuracyOk: p.accuracyOk,
      evaluatorOk: p.evaluatorOk,
      versionOk: p.versionOk,
    });
  },
  expireCertification(
    certificationId: string,
    now: number,
    expectActive: number,
    expiredCode: number,
  ): CircuitCall {
    return call("CertificationRegistry", "expireCertification", {
      certKey: chainKeyHex("certification", certificationId),
      now,
      expectActive,
      expiredCode,
    });
  },
  markRevoked(
    certificationId: string,
    expectActive: number,
    revokedCode: number,
    authority: string,
  ): CircuitCall {
    return call("CertificationRegistry", "markRevoked", {
      certKey: chainKeyHex("certification", certificationId),
      expectActive,
      revokedCode,
      authority,
    });
  },
  markSuperseded(
    certificationId: string,
    expectActive: number,
    expiredCode: number,
    authority: string,
  ): CircuitCall {
    return call("CertificationRegistry", "markSuperseded", {
      certKey: chainKeyHex("certification", certificationId),
      expectActive,
      expiredCode,
      authority,
    });
  },
  restoreCertification(
    certificationId: string,
    expectRevoked: number,
    activeCode: number,
    authority: string,
  ): CircuitCall {
    return call("CertificationRegistry", "restoreCertification", {
      certKey: chainKeyHex("certification", certificationId),
      expectRevoked,
      activeCode,
      authority,
    });
  },
  revokeCertification(p: {
    revocationId: string;
    certificationId: string;
    reason: string;
    revokerCommitment: string;
    timestamp: number;
  }): CircuitCall {
    return call("RevocationRegistry", "revokeCertification", {
      revocationKey: chainKeyHex("revocation", p.revocationId),
      certKey: chainKeyHex("certification", p.certificationId),
      reason: p.reason,
      revokerCommitment: p.revokerCommitment,
      timestamp: p.timestamp,
    });
  },
};

export function ownerCommitment(secret: string): string {
  return sha256Hex(`owner:${secret}`);
}

export function evaluatorCredential(evaluatorId: string, secret: string): string {
  return sha256Hex(`evaluator:${evaluatorId}:${secret}`);
}

// The on-chain governor commitment for privileged circuits. The backend
// API gate (ADMIN_SECRET) and the chain governor are the same secret, so a
// caller that passes the backend check also satisfies the circuit assert.
export function governorCommitment(adminSecret: string): string {
  return sha256Hex(`governor:${adminSecret}`);
}

export function proofCommitment(attestation: string): string {
  return sha256Hex(`proof:${attestation}`);
}
