import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<PS> = {
}

export type ImpureCircuits<PS> = {
  initGovernor(context: __compactRuntime.CircuitContext<PS>, g_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  issueCertification(context: __compactRuntime.CircuitContext<PS>,
                     certKey_0: Uint8Array,
                     modelKey_0: Uint8Array,
                     evaluationKey_0: Uint8Array,
                     issuedAt_0: bigint,
                     expiresAt_0: bigint,
                     activeCode_0: bigint,
                     datasetOk_0: boolean,
                     accuracyOk_0: boolean,
                     evaluatorOk_0: boolean,
                     versionOk_0: boolean): __compactRuntime.CircuitResults<PS, []>;
  expireCertification(context: __compactRuntime.CircuitContext<PS>,
                      certKey_0: Uint8Array,
                      now_0: bigint,
                      expectActive_0: bigint,
                      expiredCode_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  markRevoked(context: __compactRuntime.CircuitContext<PS>,
              certKey_0: Uint8Array,
              expectActive_0: bigint,
              revokedCode_0: bigint,
              authority_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  markSuperseded(context: __compactRuntime.CircuitContext<PS>,
                 certKey_0: Uint8Array,
                 expectActive_0: bigint,
                 expiredCode_0: bigint,
                 authority_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  restoreCertification(context: __compactRuntime.CircuitContext<PS>,
                       certKey_0: Uint8Array,
                       expectRevoked_0: bigint,
                       activeCode_0: bigint,
                       authority_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  initGovernor(context: __compactRuntime.CircuitContext<PS>, g_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  issueCertification(context: __compactRuntime.CircuitContext<PS>,
                     certKey_0: Uint8Array,
                     modelKey_0: Uint8Array,
                     evaluationKey_0: Uint8Array,
                     issuedAt_0: bigint,
                     expiresAt_0: bigint,
                     activeCode_0: bigint,
                     datasetOk_0: boolean,
                     accuracyOk_0: boolean,
                     evaluatorOk_0: boolean,
                     versionOk_0: boolean): __compactRuntime.CircuitResults<PS, []>;
  expireCertification(context: __compactRuntime.CircuitContext<PS>,
                      certKey_0: Uint8Array,
                      now_0: bigint,
                      expectActive_0: bigint,
                      expiredCode_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  markRevoked(context: __compactRuntime.CircuitContext<PS>,
              certKey_0: Uint8Array,
              expectActive_0: bigint,
              revokedCode_0: bigint,
              authority_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  markSuperseded(context: __compactRuntime.CircuitContext<PS>,
                 certKey_0: Uint8Array,
                 expectActive_0: bigint,
                 expiredCode_0: bigint,
                 authority_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  restoreCertification(context: __compactRuntime.CircuitContext<PS>,
                       certKey_0: Uint8Array,
                       expectRevoked_0: bigint,
                       activeCode_0: bigint,
                       authority_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
}

export type Circuits<PS> = {
  initGovernor(context: __compactRuntime.CircuitContext<PS>, g_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  issueCertification(context: __compactRuntime.CircuitContext<PS>,
                     certKey_0: Uint8Array,
                     modelKey_0: Uint8Array,
                     evaluationKey_0: Uint8Array,
                     issuedAt_0: bigint,
                     expiresAt_0: bigint,
                     activeCode_0: bigint,
                     datasetOk_0: boolean,
                     accuracyOk_0: boolean,
                     evaluatorOk_0: boolean,
                     versionOk_0: boolean): __compactRuntime.CircuitResults<PS, []>;
  expireCertification(context: __compactRuntime.CircuitContext<PS>,
                      certKey_0: Uint8Array,
                      now_0: bigint,
                      expectActive_0: bigint,
                      expiredCode_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  markRevoked(context: __compactRuntime.CircuitContext<PS>,
              certKey_0: Uint8Array,
              expectActive_0: bigint,
              revokedCode_0: bigint,
              authority_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  markSuperseded(context: __compactRuntime.CircuitContext<PS>,
                 certKey_0: Uint8Array,
                 expectActive_0: bigint,
                 expiredCode_0: bigint,
                 authority_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  restoreCertification(context: __compactRuntime.CircuitContext<PS>,
                       certKey_0: Uint8Array,
                       expectRevoked_0: bigint,
                       activeCode_0: bigint,
                       authority_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type Ledger = {
  readonly governor: Uint8Array;
  readonly governorSet: boolean;
  certModel: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): Uint8Array;
    [Symbol.iterator](): Iterator<[Uint8Array, Uint8Array]>
  };
  certEvaluation: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): Uint8Array;
    [Symbol.iterator](): Iterator<[Uint8Array, Uint8Array]>
  };
  certStatus: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): bigint;
    [Symbol.iterator](): Iterator<[Uint8Array, bigint]>
  };
  certIssuedAt: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): bigint;
    [Symbol.iterator](): Iterator<[Uint8Array, bigint]>
  };
  certExpiresAt: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): bigint;
    [Symbol.iterator](): Iterator<[Uint8Array, bigint]>
  };
  badgeDataset: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<[Uint8Array, boolean]>
  };
  badgeAccuracy: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<[Uint8Array, boolean]>
  };
  badgeEvaluator: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<[Uint8Array, boolean]>
  };
  badgeVersion: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<[Uint8Array, boolean]>
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
