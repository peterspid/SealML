import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<PS> = {
}

export type ImpureCircuits<PS> = {
  submitEvaluation(context: __compactRuntime.CircuitContext<PS>,
                   evaluationKey_0: Uint8Array,
                   modelKey_0: Uint8Array,
                   datasetKey_0: Uint8Array,
                   evaluatorKey_0: Uint8Array,
                   modelHash_0: Uint8Array,
                   datasetCommitment_0: Uint8Array,
                   evaluatorAuthorized_0: boolean,
                   accuracyMet_0: boolean,
                   precisionMet_0: boolean,
                   recallMet_0: boolean,
                   errorMet_0: boolean,
                   minSamples_0: bigint,
                   samplesEvaluated_0: bigint,
                   fairnessMet_0: boolean,
                   fairnessDelta_0: bigint,
                   fairnessThreshold_0: bigint,
                   fairnessMetric_0: string,
                   proofCommitment_0: Uint8Array,
                   evalTimestamp_0: bigint): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  submitEvaluation(context: __compactRuntime.CircuitContext<PS>,
                   evaluationKey_0: Uint8Array,
                   modelKey_0: Uint8Array,
                   datasetKey_0: Uint8Array,
                   evaluatorKey_0: Uint8Array,
                   modelHash_0: Uint8Array,
                   datasetCommitment_0: Uint8Array,
                   evaluatorAuthorized_0: boolean,
                   accuracyMet_0: boolean,
                   precisionMet_0: boolean,
                   recallMet_0: boolean,
                   errorMet_0: boolean,
                   minSamples_0: bigint,
                   samplesEvaluated_0: bigint,
                   fairnessMet_0: boolean,
                   fairnessDelta_0: bigint,
                   fairnessThreshold_0: bigint,
                   fairnessMetric_0: string,
                   proofCommitment_0: Uint8Array,
                   evalTimestamp_0: bigint): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
}

export type Circuits<PS> = {
  submitEvaluation(context: __compactRuntime.CircuitContext<PS>,
                   evaluationKey_0: Uint8Array,
                   modelKey_0: Uint8Array,
                   datasetKey_0: Uint8Array,
                   evaluatorKey_0: Uint8Array,
                   modelHash_0: Uint8Array,
                   datasetCommitment_0: Uint8Array,
                   evaluatorAuthorized_0: boolean,
                   accuracyMet_0: boolean,
                   precisionMet_0: boolean,
                   recallMet_0: boolean,
                   errorMet_0: boolean,
                   minSamples_0: bigint,
                   samplesEvaluated_0: bigint,
                   fairnessMet_0: boolean,
                   fairnessDelta_0: bigint,
                   fairnessThreshold_0: bigint,
                   fairnessMetric_0: string,
                   proofCommitment_0: Uint8Array,
                   evalTimestamp_0: bigint): __compactRuntime.CircuitResults<PS, []>;
}

export type Ledger = {
  evalModel: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): Uint8Array;
    [Symbol.iterator](): Iterator<[Uint8Array, Uint8Array]>
  };
  evalDataset: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): Uint8Array;
    [Symbol.iterator](): Iterator<[Uint8Array, Uint8Array]>
  };
  evalEvaluator: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): Uint8Array;
    [Symbol.iterator](): Iterator<[Uint8Array, Uint8Array]>
  };
  evalModelHash: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): Uint8Array;
    [Symbol.iterator](): Iterator<[Uint8Array, Uint8Array]>
  };
  evalDatasetCommitment: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): Uint8Array;
    [Symbol.iterator](): Iterator<[Uint8Array, Uint8Array]>
  };
  evalEvaluatorAuth: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<[Uint8Array, boolean]>
  };
  evalAccuracyMet: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<[Uint8Array, boolean]>
  };
  evalPrecisionMet: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<[Uint8Array, boolean]>
  };
  evalRecallMet: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<[Uint8Array, boolean]>
  };
  evalErrorMet: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<[Uint8Array, boolean]>
  };
  evalMinSamples: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): bigint;
    [Symbol.iterator](): Iterator<[Uint8Array, bigint]>
  };
  evalSamples: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): bigint;
    [Symbol.iterator](): Iterator<[Uint8Array, bigint]>
  };
  evalFairnessMet: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<[Uint8Array, boolean]>
  };
  evalFairnessDelta: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): bigint;
    [Symbol.iterator](): Iterator<[Uint8Array, bigint]>
  };
  evalFairnessThreshold: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): bigint;
    [Symbol.iterator](): Iterator<[Uint8Array, bigint]>
  };
  evalFairnessMetric: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): string;
    [Symbol.iterator](): Iterator<[Uint8Array, string]>
  };
  evalProof: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): Uint8Array;
    [Symbol.iterator](): Iterator<[Uint8Array, Uint8Array]>
  };
  evalTime: {
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
