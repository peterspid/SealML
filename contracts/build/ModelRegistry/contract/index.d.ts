import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<PS> = {
}

export type ImpureCircuits<PS> = {
  registerModel(context: __compactRuntime.CircuitContext<PS>,
                modelKey_0: Uint8Array,
                hash_0: Uint8Array,
                version_0: string,
                category_0: string,
                ownerCommitment_0: Uint8Array,
                registeredAt_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  updateModelVersion(context: __compactRuntime.CircuitContext<PS>,
                     modelKey_0: Uint8Array,
                     newHash_0: Uint8Array,
                     newVersion_0: string,
                     ownerCommitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  deactivateModel(context: __compactRuntime.CircuitContext<PS>,
                  modelKey_0: Uint8Array,
                  ownerCommitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  registerModel(context: __compactRuntime.CircuitContext<PS>,
                modelKey_0: Uint8Array,
                hash_0: Uint8Array,
                version_0: string,
                category_0: string,
                ownerCommitment_0: Uint8Array,
                registeredAt_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  updateModelVersion(context: __compactRuntime.CircuitContext<PS>,
                     modelKey_0: Uint8Array,
                     newHash_0: Uint8Array,
                     newVersion_0: string,
                     ownerCommitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  deactivateModel(context: __compactRuntime.CircuitContext<PS>,
                  modelKey_0: Uint8Array,
                  ownerCommitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
}

export type Circuits<PS> = {
  registerModel(context: __compactRuntime.CircuitContext<PS>,
                modelKey_0: Uint8Array,
                hash_0: Uint8Array,
                version_0: string,
                category_0: string,
                ownerCommitment_0: Uint8Array,
                registeredAt_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  updateModelVersion(context: __compactRuntime.CircuitContext<PS>,
                     modelKey_0: Uint8Array,
                     newHash_0: Uint8Array,
                     newVersion_0: string,
                     ownerCommitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  deactivateModel(context: __compactRuntime.CircuitContext<PS>,
                  modelKey_0: Uint8Array,
                  ownerCommitment_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type Ledger = {
  modelHash: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): Uint8Array;
    [Symbol.iterator](): Iterator<[Uint8Array, Uint8Array]>
  };
  modelVersion: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): string;
    [Symbol.iterator](): Iterator<[Uint8Array, string]>
  };
  modelCategory: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): string;
    [Symbol.iterator](): Iterator<[Uint8Array, string]>
  };
  modelOwner: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): Uint8Array;
    [Symbol.iterator](): Iterator<[Uint8Array, Uint8Array]>
  };
  modelRegisteredAt: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): bigint;
    [Symbol.iterator](): Iterator<[Uint8Array, bigint]>
  };
  modelActive: {
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
