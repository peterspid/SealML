import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  CertificationRecord,
  DatasetRecord,
  EvaluationRecord,
  EvaluatorRecord,
  ModelRecord,
  RevocationRecord,
} from "../../shared/types";

export interface Ledger {
  models: Record<string, ModelRecord & { chainTx: string | null }>;
  datasets: Record<string, DatasetRecord & { chainTx: string | null }>;
  evaluators: Record<string, EvaluatorRecord & { chainTx: string | null }>;
  evaluations: Record<string, EvaluationRecord & { chainTx: string | null }>;
  certifications: Record<string, CertificationRecord>;
  revocations: Record<string, RevocationRecord & { chainTx: string | null }>;
}

const EMPTY: Ledger = {
  models: {},
  datasets: {},
  evaluators: {},
  evaluations: {},
  certifications: {},
  revocations: {},
};

export class Store {
  // Serializes read-modify-write cycles so concurrent POSTs cannot
  // silently drop each other's records.
  private queue: Promise<Ledger> = Promise.resolve(
    JSON.parse(JSON.stringify(EMPTY)) as Ledger,
  );

  constructor(private file: string) {}

  async load(): Promise<Ledger> {
    try {
      const raw = await fs.readFile(this.file, "utf8");
      return { ...EMPTY, ...(JSON.parse(raw) as Ledger) };
    } catch {
      return JSON.parse(JSON.stringify(EMPTY)) as Ledger;
    }
  }

  async save(ledger: Ledger): Promise<void> {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.writeFile(this.file, JSON.stringify(ledger, null, 2), "utf8");
  }

  update(fn: (ledger: Ledger) => void): Promise<Ledger> {
    const next = this.queue.then(async () => {
      const ledger = await this.load();
      fn(ledger);
      await this.save(ledger);
      return ledger;
    });
    // Keep the chain alive even when a step rejects; the caller still
    // receives this step's own rejection.
    this.queue = next.catch(() => this.load());
    return next;
  }
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
