pragma circom 2.2.3;

include "comparators.circom";

include "./ProcessTallyBallot.circom";

/// Proves one tally batch: the accepted Ballots in this chunk extend the
/// chain hash, update the live-ballot tree (last-wins by user commitment),
/// and homomorphically update the tally accumulator. The poll private key
/// is not used; tally totals are opened by TallyFinalize.
///
/// The circuit verifies:
/// - `realBallotCount` is at most `BATCH_SIZE` (8-bit compare; `BATCH_SIZE`
///   may be at most 255, intended production max 50).
/// - Slots `i < realBallotCount` are real Ballots; later slots are dummy
///   (curve identity) and are not absorbed into the chain hash or tree.
/// - Each real Ballot's hash is bound to its user commitment and encrypted
///   Votes and is absorbed into the chain hash in order.
/// - A first Ballot for a user commitment is inserted into the indexed
///   live-ballot tree (non-membership via the predecessor gap).
/// - A later Ballot for the same commitment updates that leaf and
///   subtracts the previous live ciphertext from the accumulator.
/// - Dummy slots do not change the chain hash, live-ballot root, or
///   accumulator.
///
/// @param BATCH_SIZE Maximum Ballots in this proof.
/// @param VOTE_OPTIONS Number of vote options.
/// @param LIVE_TREE_DEPTH Depth of the indexed live-ballot tree.
template TallyBatch(BATCH_SIZE, VOTE_OPTIONS, LIVE_TREE_DEPTH) {
    // Private inputs
    // 1 if this slot is the first live Ballot for its user commitment; 0 if it supersedes one.
    signal input isNew[BATCH_SIZE];
    // User commitment for each slot.
    signal input userCommitment[BATCH_SIZE];
    // Encrypted Votes C1 for each slot.
    signal input encryptedVotesC1[BATCH_SIZE][VOTE_OPTIONS][2];
    // Encrypted Votes C2 for each slot.
    signal input encryptedVotesC2[BATCH_SIZE][VOTE_OPTIONS][2];
    // Previous live encrypted Votes C1 (identity on insert or dummy).
    signal input oldEncryptedVotesC1[BATCH_SIZE][VOTE_OPTIONS][2];
    // Previous live encrypted Votes C2 (identity on insert or dummy).
    signal input oldEncryptedVotesC2[BATCH_SIZE][VOTE_OPTIONS][2];
    // Leaf index of the user commitment (new slot on insert; existing leaf on update).
    signal input leafIndex[BATCH_SIZE];
    // Next-key pointer stored on the user leaf (copied from the predecessor on insert).
    signal input leafNextKey[BATCH_SIZE];
    // Merkle path for an in-place live-ballot update.
    signal input leafPath[BATCH_SIZE][LIVE_TREE_DEPTH];
    // Merkle path for the empty slot written on insert (after the predecessor update).
    signal input slotPath[BATCH_SIZE][LIVE_TREE_DEPTH];
    // Predecessor leaf index in the sorted live-ballot list (insert).
    signal input predecessorIndex[BATCH_SIZE];
    // Predecessor user commitment (insert).
    signal input predecessorKey[BATCH_SIZE];
    // Predecessor next-key pointer before splicing in this commitment (insert).
    signal input predecessorNextKey[BATCH_SIZE];
    // Predecessor live-ballot leaf value (insert).
    signal input predecessorValue[BATCH_SIZE];
    // Merkle path for the predecessor leaf (insert).
    signal input predecessorPath[BATCH_SIZE][LIVE_TREE_DEPTH];

    // Public inputs
    // Poll ID bound into each Ballot hash.
    signal input pollId;
    // Number of real Ballots in this batch (slots at and after this index are dummy).
    signal input realBallotCount;
    // Chain hash before this batch.
    signal input currentChainHash;
    // Chain hash after absorbing the real Ballots.
    signal input newChainHash;
    // Live-ballot tree root before this batch.
    signal input currentLiveRoot;
    // Live-ballot tree root after this batch.
    signal input newLiveRoot;
    // Tally accumulator C1 points before this batch.
    signal input currentAccumulatorC1[VOTE_OPTIONS][2];
    // Tally accumulator C2 points before this batch.
    signal input currentAccumulatorC2[VOTE_OPTIONS][2];
    // Tally accumulator C1 points after this batch.
    signal input newAccumulatorC1[VOTE_OPTIONS][2];
    // Tally accumulator C2 points after this batch.
    signal input newAccumulatorC2[VOTE_OPTIONS][2];

    // Verify that the batch is not larger than the circuit capacity.
    signal realBallotCountInRange <== LessEqThan(8)([realBallotCount, BATCH_SIZE]);
    realBallotCountInRange === 1;

    component process[BATCH_SIZE];
    component isReal[BATCH_SIZE];

    signal chainHash[BATCH_SIZE + 1];
    signal liveRoot[BATCH_SIZE + 1];
    signal accC1[BATCH_SIZE + 1][VOTE_OPTIONS][2];
    signal accC2[BATCH_SIZE + 1][VOTE_OPTIONS][2];

    chainHash[0] <== currentChainHash;
    liveRoot[0] <== currentLiveRoot;
    accC1[0] <== currentAccumulatorC1;
    accC2[0] <== currentAccumulatorC2;

    // Process each slot in order. Real slots (`i < realBallotCount`) are
    // absorbed; dummy slots must not change the running state.
    for (var slot = 0; slot < BATCH_SIZE; slot += 1) {
        isReal[slot] = LessThan(8);
        isReal[slot].in[0] <== slot;
        isReal[slot].in[1] <== realBallotCount;

        process[slot] = ProcessTallyBallot(VOTE_OPTIONS, LIVE_TREE_DEPTH);
        process[slot].isReal <== isReal[slot].out;
        process[slot].isNew <== isNew[slot];
        process[slot].pollId <== pollId;
        process[slot].currentChainHash <== chainHash[slot];
        process[slot].currentLiveRoot <== liveRoot[slot];
        process[slot].currentAccumulatorC1 <== accC1[slot];
        process[slot].currentAccumulatorC2 <== accC2[slot];
        process[slot].userCommitment <== userCommitment[slot];
        process[slot].encryptedVotesC1 <== encryptedVotesC1[slot];
        process[slot].encryptedVotesC2 <== encryptedVotesC2[slot];
        process[slot].oldEncryptedVotesC1 <== oldEncryptedVotesC1[slot];
        process[slot].oldEncryptedVotesC2 <== oldEncryptedVotesC2[slot];
        process[slot].leafIndex <== leafIndex[slot];
        process[slot].leafNextKey <== leafNextKey[slot];
        process[slot].leafPath <== leafPath[slot];
        process[slot].slotPath <== slotPath[slot];
        process[slot].predecessorIndex <== predecessorIndex[slot];
        process[slot].predecessorKey <== predecessorKey[slot];
        process[slot].predecessorNextKey <== predecessorNextKey[slot];
        process[slot].predecessorValue <== predecessorValue[slot];
        process[slot].predecessorPath <== predecessorPath[slot];

        chainHash[slot + 1] <== process[slot].newChainHash;
        liveRoot[slot + 1] <== process[slot].newLiveRoot;
        accC1[slot + 1] <== process[slot].newAccumulatorC1;
        accC2[slot + 1] <== process[slot].newAccumulatorC2;
    }

    // Bind the public outputs to the state after the last slot.
    newChainHash === chainHash[BATCH_SIZE];
    newLiveRoot === liveRoot[BATCH_SIZE];
    newAccumulatorC1 === accC1[BATCH_SIZE];
    newAccumulatorC2 === accC2[BATCH_SIZE];
}
