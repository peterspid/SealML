// On-chain enum codes. These mirror the Uint<64> values stored in the
// Compact registries — the single source of truth for status/approval
// labels. Backend and frontend import from here; nothing hardcodes
// status strings or numbers elsewhere.
import type {
  CertificationStatus,
  RevocationReason,
} from "./types";

export const CERT_STATUS: Record<CertificationStatus, number> = {
  Active: 0,
  Expired: 1,
  Revoked: 2,
};

export const CERT_STATUS_LABEL: Record<number, CertificationStatus> = {
  0: "Active",
  1: "Expired",
  2: "Revoked",
};

// 0 = pending, 1 = approved, 2 = revoked, 3 = expired
export const DATASET_APPROVAL = {
  pending: 0,
  approved: 1,
  revoked: 2,
  expired: 3,
} as const;

export type DatasetApprovalLabel = keyof typeof DATASET_APPROVAL;

const APPROVAL_LABEL: Record<number, DatasetApprovalLabel> = {
  0: "pending",
  1: "approved",
  2: "revoked",
  3: "expired",
};

export function approvalLabel(code: number): DatasetApprovalLabel {
  return APPROVAL_LABEL[code] ?? "pending";
}

export const REVOCATION_REASON: Record<RevocationReason, string> = {
  "model-modified": "model-modified",
  "bad-evaluation": "bad-evaluation",
  "invalid-dataset": "invalid-dataset",
  "evaluator-misconduct": "evaluator-misconduct",
  "security-issue": "security-issue",
};

// Default certification lifetime in days, used when the caller does not
// supply an explicit expiry. Read from env CERT_DEFAULT_DAYS when set.
export function defaultCertLifetimeDays(): number {
  const raw = process.env.CERT_DEFAULT_DAYS;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 90;
}
