export type { BinaryMerkleTreeProof } from "./circomkit.js";
export { circomkitInstance, generateBinaryMerkleRoot, getSignal, getSignalArray } from "./circomkit.js";
export type {
  EncryptedBallot,
  TallyBatchPrivateInputs,
  TallyBatchPublicInputs,
  TallyBatchSignals,
  TallySlotWitness,
} from "./tally.js";
export {
  BATCH_SIZE,
  LIVE_TREE_DEPTH,
  VOTE_OPTIONS,
  addAffine,
  affinePoint,
  batchFromSlots,
  dummySlot,
  insertSlot,
  pollPublicKeyFrom,
  tallyBatchWitness,
  updateSlot,
  zeroPath,
} from "./tally.js";
