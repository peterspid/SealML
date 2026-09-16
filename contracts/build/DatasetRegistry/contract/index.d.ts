import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<PS> = {
}

export type ImpureCircuits<PS> = {
  initGovernor(context: __compactRuntime.CircuitContext<PS>, g_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  certifyDataset(context: __compactRuntime.CircuitContext<PS>,
                 datasetKey_0: Uint8Array,
                 commitment_0: Uint8Array,
                 version_0: string,
                 sizeClaim_0: bigint,
                 qualityClaim_0: bigint,
                 approvedCode_0: bigint,
                 expiresAt_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  setDatasetApproval(context: __compactRuntime.CircuitContext<PS>,
                     datasetKey_0: Uint8Array,
                     approval_0: bigint,
                     authority_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  expireDataset(context: __compactRuntime.CircuitContext<PS>,
                datasetKey_0: Uint8Array,
                now_0: bigint,
                expiredCode_0: bigint): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  initGovernor(context: __compactRuntime.CircuitContext<PS>, g_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  certifyDataset(context: __compactRuntime.CircuitContext<PS>,
                 datasetKey_0: Uint8Array,
                 commitment_0: Uint8Array,
                 version_0: string,
                 sizeClaim_0: bigint,
                 qualityClaim_0: bigint,
                 approvedCode_0: bigint,
                 expiresAt_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  setDatasetApproval(context: __compactRuntime.CircuitContext<PS>,
                     datasetKey_0: Uint8Array,
                     approval_0: bigint,
                     authority_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  expireDataset(context: __compactRuntime.CircuitContext<PS>,
                datasetKey_0: Uint8Array,
                now_0: bigint,
                expiredCode_0: bigint): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
}

export type Circuits<PS> = {
  initGovernor(context: __compactRuntime.CircuitContext<PS>, g_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  certifyDataset(context: __compactRuntime.CircuitContext<PS>,
                 datasetKey_0: Uint8Array,
                 commitment_0: Uint8Array,
                 version_0: string,
                 sizeClaim_0: bigint,
                 qualityClaim_0: bigint,
                 approvedCode_0: bigint,
                 expiresAt_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  setDatasetApproval(context: __compactRuntime.CircuitContext<PS>,
                     datasetKey_0: Uint8Array,
                     approval_0: bigint,
                     authority_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  expireDataset(context: __compactRuntime.CircuitContext<PS>,
                datasetKey_0: Uint8Array,
                now_0: bigint,
                expiredCode_0: bigint): __compactRuntime.CircuitResults<PS, []>;
}

export type Ledger = {
  readonly governor: Uint8Array;
  readonly governorSet: boolean;
  datasetCommitment: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): Uint8Array;
    [Symbol.iterator](): Iterator<[Uint8Array, Uint8Array]>
  };
  datasetVersion: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): string;
    [Symbol.iterator](): Iterator<[Uint8Array, string]>
  };
  datasetApproval: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): bigint;
    [Symbol.iterator](): Iterator<[Uint8Array, bigint]>
  };
  datasetSizeClaim: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): bigint;
    [Symbol.iterator](): Iterator<[Uint8Array, bigint]>
  };
  datasetQualityClaim: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): bigint;
    [Symbol.iterator](): Iterator<[Uint8Array, bigint]>
  };
  datasetConsent: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<[Uint8Array, boolean]>
  };
  datasetExpiry: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): bigint;
    [Symbol.iterator](): Iterator<[Uint8Array, bigint]>
  };
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
