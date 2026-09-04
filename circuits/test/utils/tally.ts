import { identityCiphertexts } from "../../ts/liveBallotTree.js";

/** Compiled tally-batch width for tests. Intended production max is 50. */
export const BATCH_SIZE = 4;
/** Compiled vote-option width for tests. Production polls may have 100+. */
export const VOTE_OPTIONS = 5;
export const LIVE_TREE_DEPTH = 4;

export interface TallySlotWitness {
  isNew: bigint;
  userCommitment: bigint;
  encryptedVotesC1: [bigint, bigint][];
  encryptedVotesC2: [bigint, bigint][];
  oldEncryptedVotesC1: [bigint, bigint][];
  oldEncryptedVotesC2: [bigint, bigint][];
  leafIndex: bigint;
  leafNextKey: bigint;
  leafPath: bigint[];
  slotPath: bigint[];
  predecessorIndex: bigint;
  predecessorKey: bigint;
  predecessorNextKey: bigint;
  predecessorValue: bigint;
  predecessorPath: bigint[];
}

export interface EncryptedBallot {
  userCommitment: bigint;
  c1: [bigint, bigint][];
  c2: [bigint, bigint][];
  ballotHash: bigint;
}

export interface TallyBatchPrivateInputs {
  isNew: bigint[];
  userCommitment: bigint[];
  encryptedVotesC1: [bigint, bigint][][];
  encryptedVotesC2: [bigint, bigint][][];
  oldEncryptedVotesC1: [bigint, bigint][][];
  oldEncryptedVotesC2: [bigint, bigint][][];
  leafIndex: bigint[];
  leafNextKey: bigint[];
  leafPath: bigint[][];
  slotPath: bigint[][];
  predecessorIndex: bigint[];
  predecessorKey: bigint[];
  predecessorNextKey: bigint[];
  predecessorValue: bigint[];
  predecessorPath: bigint[][];
}

export const zeroPath = (): bigint[] => Array.from({ length: LIVE_TREE_DEPTH }, () => 0n);

export const dummySlot = (): TallySlotWitness => {
  const identity = identityCiphertexts(VOTE_OPTIONS);

  return {
    isNew: 0n,
    userCommitment: 0n,
    encryptedVotesC1: identity.c1,
    encryptedVotesC2: identity.c2,
    oldEncryptedVotesC1: identity.c1,
    oldEncryptedVotesC2: identity.c2,
    leafIndex: 0n,
    leafNextKey: 0n,
    leafPath: zeroPath(),
    slotPath: zeroPath(),
    predecessorIndex: 0n,
    predecessorKey: 0n,
    predecessorNextKey: 0n,
    predecessorValue: 0n,
    predecessorPath: zeroPath(),
  };
};

export const batchFromSlots = (slots: TallySlotWitness[]): TallyBatchPrivateInputs => {
  const padded = [...slots];

  while (padded.length < BATCH_SIZE) {
    padded.push(dummySlot());
  }

  return {
    isNew: padded.map((slot) => slot.isNew),
    userCommitment: padded.map((slot) => slot.userCommitment),
    encryptedVotesC1: padded.map((slot) => slot.encryptedVotesC1),
    encryptedVotesC2: padded.map((slot) => slot.encryptedVotesC2),
    oldEncryptedVotesC1: padded.map((slot) => slot.oldEncryptedVotesC1),
    oldEncryptedVotesC2: padded.map((slot) => slot.oldEncryptedVotesC2),
    leafIndex: padded.map((slot) => slot.leafIndex),
    leafNextKey: padded.map((slot) => slot.leafNextKey),
    leafPath: padded.map((slot) => slot.leafPath),
    slotPath: padded.map((slot) => slot.slotPath),
    predecessorIndex: padded.map((slot) => slot.predecessorIndex),
    predecessorKey: padded.map((slot) => slot.predecessorKey),
    predecessorNextKey: padded.map((slot) => slot.predecessorNextKey),
    predecessorValue: padded.map((slot) => slot.predecessorValue),
    predecessorPath: padded.map((slot) => slot.predecessorPath),
  };
};
