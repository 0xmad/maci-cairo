export type { BinaryMerkleTreeProof } from "./circomkit.js";
export { circomkitInstance, generateBinaryMerkleRoot, getSignal, getSignalArray } from "./circomkit.js";
export type { EncryptedBallot, TallyBatchPrivateInputs, TallySlotWitness } from "./tally.js";
export { BATCH_SIZE, LIVE_TREE_DEPTH, VOTE_OPTIONS, batchFromSlots, dummySlot, zeroPath } from "./tally.js";
