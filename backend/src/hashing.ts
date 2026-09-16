import { createHash, randomBytes } from "node:crypto";

// sha256 hex of arbitrary text (model files, ids, attestations).
export function sha256Hex(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

// On-chain map key: sha256("<domain>:<id>") as 32 raw bytes.
// Compact Map<Bytes<32>, _> keys are derived off-chain this way.
export function chainKey(domain: string, id: string): Buffer {
  return createHash("sha256").update(`${domain}:${id}`, "utf8").digest();
}

export function chainKeyHex(domain: string, id: string): string {
  return chainKey(domain, id).toString("hex");
}

export function unixNow(): number {
  return Math.floor(Date.now() / 1000);
}

export function daysFromNow(days: number, fromUnix?: number): number {
  return (fromUnix ?? unixNow()) + Math.floor(days) * 86400;
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${randomBytes(4).toString("hex")}`;
}
