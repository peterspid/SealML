// Shared domain types. Shapes only — every threshold, duration and role
// value is read from on-chain registry state at runtime, never hardcoded
// in routes or UI.

export type ModelCategory =
  | "fraud-detection"
  | "medical-diagnosis"
  | "credit-risk"
  | "recommendation"
  | "computer-vision"
  | "other";

export type EvaluatorRole =
  | "university"
  | "auditor"
  | "enterprise"
  | "government";

export type MetricType = "accuracy" | "precision" | "recall" | "error-rate";

export type CertificationStatus = "Active" | "Expired" | "Revoked";

export type RevocationReason =
  | "model-modified"
  | "bad-evaluation"
  | "invalid-dataset"
  | "evaluator-misconduct"
  | "security-issue";

export interface ModelRecord {
  modelId: string;
  modelHash: string; // hex sha256 of the model file
  version: string;
  category: ModelCategory;
  ownerCredential: string; // commitment, never raw identity
  developer: string;
  description: string;
  registrationTime: string; // ISO timestamp
  active: boolean;
}

export interface DatasetRecord {
  datasetId: string;
  datasetCommitment: string; // hex commitment, raw data never on-chain
  datasetVersion: string;
  approvalStatus: "pending" | "approved" | "revoked" | "expired";
  sizeClaim: number; // claimed sample count (claim only)
  qualityClaim: number; // 0..1 claimed quality score
  consentFlag: boolean;
  source: string;
  categories: string[];
  expiresAt: string;
}

export interface EvaluatorRecord {
  evaluatorId: string;
  organization: string;
  role: EvaluatorRole;
  credentialCommitment: string;
  authorized: boolean;
  expiresAt: string;
}

export interface MetricClaim {
  metric: MetricType;
  threshold: number; // e.g. 0.90
  met: boolean; // claim only — raw predictions stay off-chain
}

export interface FairnessClaim {
  metric: string; // exact metric name, e.g. "group-error-rate-delta"
  groups: string[];
  delta: number; // observed difference (claim)
  threshold: number; // allowed maximum
  met: boolean;
  conditions: string;
}

export interface EvaluationRecord {
  evaluationId: string;
  modelId: string;
  modelVersionAtEval: string;
  modelHashAtEval: string;
  datasetId: string;
  evaluatorId: string;
  metricClaims: MetricClaim[];
  fairnessClaim: FairnessClaim | null;
  minSamples: number;
  samplesEvaluated: number;
  proofCommitment: string; // attestation / ZK proof commitment
  evaluationDate: string;
}

export interface CertificationRecord {
  certificationId: string;
  modelId: string;
  evaluationId: string;
  status: CertificationStatus;
  issuedAt: string;
  expiresAt: string;
  badges: CertificationBadges;
  txHash: string | null; // Midnight tx hash once submitted
}

export interface CertificationBadges {
  datasetVerified: boolean;
  accuracyThresholdVerified: boolean;
  evaluatorVerified: boolean;
  modelVersionVerified: boolean;
  certificationActive: boolean;
}

export interface RevocationRecord {
  revocationId: string;
  certificationId: string;
  reason: RevocationReason;
  revokerCredential: string;
  timestamp: string;
}

export interface VerifyBundle {
  modelId: string;
  version: string;
  status: CertificationStatus | "Uncertified";
  modelHash: string;
  claims: MetricClaim[];
  fairness: FairnessClaim | null;
  evaluatorId: string | null;
  evaluatorAuthorized: boolean;
  issuedAt: string | null;
  expiresAt: string | null;
  revoked: boolean;
  revocationReason: RevocationReason | null;
  txHash: string | null;
}
