import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<PS> = {
}

export type ImpureCircuits<PS> = {
  initGovernor(context: __compactRuntime.CircuitContext<PS>, g_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  registerEvaluator(context: __compactRuntime.CircuitContext<PS>,
                    evaluatorKey_0: Uint8Array,
                    role_0: string,
                    org_0: string,
                    credential_0: Uint8Array,
                    expiresAt_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  setEvaluatorAuthorized(context: __compactRuntime.CircuitContext<PS>,
                         evaluatorKey_0: Uint8Array,
                         authorized_0: boolean,
                         authority_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  initGovernor(context: __compactRuntime.CircuitContext<PS>, g_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  registerEvaluator(context: __compactRuntime.CircuitContext<PS>,
                    evaluatorKey_0: Uint8Array,
                    role_0: string,
                    org_0: string,
                    credential_0: Uint8Array,
                    expiresAt_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  setEvaluatorAuthorized(context: __compactRuntime.CircuitContext<PS>,
                         evaluatorKey_0: Uint8Array,
                         authorized_0: boolean,
                         authority_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
}

export type Circuits<PS> = {
  initGovernor(context: __compactRuntime.CircuitContext<PS>, g_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  registerEvaluator(context: __compactRuntime.CircuitContext<PS>,
                    evaluatorKey_0: Uint8Array,
                    role_0: string,
                    org_0: string,
                    credential_0: Uint8Array,
                    expiresAt_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  setEvaluatorAuthorized(context: __compactRuntime.CircuitContext<PS>,
                         evaluatorKey_0: Uint8Array,
                         authorized_0: boolean,
                         authority_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type Ledger = {
  readonly governor: Uint8Array;
  readonly governorSet: boolean;
  evaluatorRole: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): string;
    [Symbol.iterator](): Iterator<[Uint8Array, string]>
  };
  evaluatorOrg: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): string;
    [Symbol.iterator](): Iterator<[Uint8Array, string]>
  };
  evaluatorCredential: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): Uint8Array;
    [Symbol.iterator](): Iterator<[Uint8Array, Uint8Array]>
  };
  evaluatorAuthorized: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<[Uint8Array, boolean]>
  };
  evaluatorExpiry: {
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
