import type { FixedBabyJub } from "../../ts/@types/circomlibjs.js";
import type {
  BabyJubPoint,
  ElGamalCiphertexts,
  LiveBallotInsertWitness,
  LiveBallotUpdateWitness,
} from "../../ts/liveBallotTree.js";
import type { Point } from "circomlibjs";

import { identityCiphertexts } from "../../ts/liveBallotTree.js";

/** Compiled tally-batch width for tests. Intended production max is 50. */
export const BATCH_SIZE = 4;
/** Compiled vote-option width for tests. Production polls may have 100+. */
export const VOTE_OPTIONS = 5;
export const LIVE_TREE_DEPTH = 4;

export type TallyBatchSignals = [
  "pollId",
  "realBallotCount",
  "currentChainHash",
  "newChainHash",
  "currentLiveRoot",
  "newLiveRoot",
  "currentAccumulatorC1",
  "currentAccumulatorC2",
  "newAccumulatorC1",
  "newAccumulatorC2",
  "isNew",
  "userCommitment",
  "encryptedVotesC1",
  "encryptedVotesC2",
  "oldEncryptedVotesC1",
  "oldEncryptedVotesC2",
  "leafIndex",
  "leafNextKey",
  "leafPath",
  "slotPath",
  "predecessorIndex",
  "predecessorKey",
  "predecessorNextKey",
  "predecessorValue",
  "predecessorPath",
];

export interface TallySlotWitness {
  isNew: bigint;
  userCommitment: bigint;
  encryptedVotesC1: BabyJubPoint[];
  encryptedVotesC2: BabyJubPoint[];
  oldEncryptedVotesC1: BabyJubPoint[];
  oldEncryptedVotesC2: BabyJubPoint[];
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
  c1: BabyJubPoint[];
  c2: BabyJubPoint[];
  ballotHash: bigint;
}

export interface TallyBatchPrivateInputs {
  isNew: bigint[];
  userCommitment: bigint[];
  encryptedVotesC1: BabyJubPoint[][];
  encryptedVotesC2: BabyJubPoint[][];
  oldEncryptedVotesC1: BabyJubPoint[][];
  oldEncryptedVotesC2: BabyJubPoint[][];
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

export interface TallyBatchPublicInputs {
  pollId: bigint;
  realBallotCount: bigint;
  currentChainHash: bigint;
  newChainHash: bigint;
  currentLiveRoot: bigint;
  newLiveRoot: bigint;
  currentAccumulatorC1: BabyJubPoint[];
  currentAccumulatorC2: BabyJubPoint[];
  newAccumulatorC1: BabyJubPoint[];
  newAccumulatorC2: BabyJubPoint[];
}

export const zeroPath = (): bigint[] => Array.from({ length: LIVE_TREE_DEPTH }, () => 0n);

export const affinePoint = (babyJub: FixedBabyJub, point: Point): BabyJubPoint => [
  babyJub.F.toObject(point[0]),
  babyJub.F.toObject(point[1]),
];

export const pollPublicKeyFrom = (babyJub: FixedBabyJub, privateKey: bigint): BabyJubPoint =>
  affinePoint(babyJub, babyJub.mulPointEscalar(babyJub.Base8, privateKey));

export const addAffine = (babyJub: FixedBabyJub, left: BabyJubPoint, right: BabyJubPoint): BabyJubPoint =>
  affinePoint(
    babyJub,
    babyJub.addPoint([babyJub.F.e(left[0]), babyJub.F.e(left[1])], [babyJub.F.e(right[0]), babyJub.F.e(right[1])]),
  );

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

export const insertSlot = (
  userCommitment: bigint,
  encrypted: ElGamalCiphertexts,
  inserted: LiveBallotInsertWitness,
  identity: ElGamalCiphertexts,
): TallySlotWitness => ({
  isNew: 1n,
  userCommitment,
  encryptedVotesC1: encrypted.c1,
  encryptedVotesC2: encrypted.c2,
  oldEncryptedVotesC1: identity.c1,
  oldEncryptedVotesC2: identity.c2,
  leafIndex: BigInt(inserted.leafIndex),
  leafNextKey: inserted.leafNextKey,
  leafPath: zeroPath(),
  slotPath: inserted.slotPath,
  predecessorIndex: BigInt(inserted.predecessorIndex),
  predecessorKey: inserted.predecessorKey,
  predecessorNextKey: inserted.predecessorNextKey,
  predecessorValue: inserted.predecessorValue,
  predecessorPath: inserted.predecessorPath,
});

export const updateSlot = (
  userCommitment: bigint,
  encrypted: ElGamalCiphertexts,
  oldEncrypted: ElGamalCiphertexts,
  updated: LiveBallotUpdateWitness,
): TallySlotWitness => {
  const dummy = dummySlot();

  return {
    isNew: 0n,
    userCommitment,
    encryptedVotesC1: encrypted.c1,
    encryptedVotesC2: encrypted.c2,
    oldEncryptedVotesC1: oldEncrypted.c1,
    oldEncryptedVotesC2: oldEncrypted.c2,
    leafIndex: BigInt(updated.leafIndex),
    leafNextKey: updated.leafNextKey,
    leafPath: updated.leafPath,
    slotPath: dummy.slotPath,
    predecessorIndex: dummy.predecessorIndex,
    predecessorKey: dummy.predecessorKey,
    predecessorNextKey: dummy.predecessorNextKey,
    predecessorValue: dummy.predecessorValue,
    predecessorPath: dummy.predecessorPath,
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

export const tallyBatchWitness = (
  pubs: TallyBatchPublicInputs,
  slots: TallySlotWitness[],
): TallyBatchPublicInputs & TallyBatchPrivateInputs => ({
  ...pubs,
  ...batchFromSlots(slots),
});
