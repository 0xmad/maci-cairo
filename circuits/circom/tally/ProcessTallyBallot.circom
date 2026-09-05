pragma circom 2.2.3;

include "babyjub.circom";
include "comparators.circom";
include "mux1.circom";
include "poseidon.circom";

include "../utils/CalculateTotalPoints.circom";
include "../utils/LessThanField.circom";
include "../utils/LiveBallotValue.circom";
include "../utils/MerkleUpdate.circom";

/// One tally-batch slot: absorb a Ballot into the chain hash, live-ballot
/// tree, and tally accumulator, or leave state unchanged for a dummy slot.
///
/// The circuit verifies:
/// - `isNew` is 0 or 1, and dummy slots (`isReal = 0`) have `isNew = 0`.
/// - A real Ballot has a nonzero user commitment.
/// - Dummy and first-seen slots use the curve identity as the previous
///   ciphertext; dummy new ciphertexts are also the identity.
/// - A real Ballot hash (poll id, user commitment, summed ciphertext
///   points) is absorbed into the chain hash; dummy slots are not.
/// - Insert (`isReal` and `isNew`): the predecessor gap contains this
///   user commitment, the predecessor leaf is updated, and an empty slot
///   becomes the new live leaf.
/// - Update (`isReal` and not `isNew`): the existing live leaf is
///   rewritten with the new ciphertext digest.
/// - The accumulator becomes previous minus old live ciphertext plus new
///   ciphertext (identity old/new on dummy or insert so the sum is a no-op
///   or a pure add).
///
/// @param VOTE_OPTIONS Number of vote options.
/// @param LIVE_TREE_DEPTH Depth of the indexed live-ballot tree.
template ProcessTallyBallot(VOTE_OPTIONS, LIVE_TREE_DEPTH) {
    // Slot flags (wired from TallyBatch)
    // 1 if this slot is a real Ballot (`slot < realBallotCount`); 0 if dummy.
    signal input isReal;
    // 1 if this is the first live Ballot for the user commitment; 0 if it supersedes one.
    signal input isNew;
    // Poll ID bound into the Ballot hash.
    signal input pollId;
    // Chain hash before this slot.
    signal input currentChainHash;
    // Live-ballot tree root before this slot.
    signal input currentLiveRoot;
    // Tally accumulator C1 points before this slot.
    signal input currentAccumulatorC1[VOTE_OPTIONS][2];
    // Tally accumulator C2 points before this slot.
    signal input currentAccumulatorC2[VOTE_OPTIONS][2];

    // Ballot witness
    // User commitment for this slot (nonzero if real).
    signal input userCommitment;
    // Encrypted Votes C1 (curve identity if dummy).
    signal input encryptedVotesC1[VOTE_OPTIONS][2];
    // Encrypted Votes C2 (curve identity if dummy).
    signal input encryptedVotesC2[VOTE_OPTIONS][2];
    // Previous live encrypted Votes C1 (identity on insert or dummy).
    signal input oldEncryptedVotesC1[VOTE_OPTIONS][2];
    // Previous live encrypted Votes C2 (identity on insert or dummy).
    signal input oldEncryptedVotesC2[VOTE_OPTIONS][2];

    // Live-ballot tree witness
    // Leaf index of the user commitment (new slot on insert; existing leaf on update).
    signal input leafIndex;
    // Next-key pointer stored on the user leaf (copied from the predecessor on insert).
    signal input leafNextKey;
    // Merkle path for an in-place live-ballot update.
    signal input leafPath[LIVE_TREE_DEPTH];
    // Merkle path for the empty slot written on insert (after the predecessor update).
    signal input slotPath[LIVE_TREE_DEPTH];
    // Predecessor leaf index in the sorted live-ballot list (insert).
    signal input predecessorIndex;
    // Predecessor user commitment (insert).
    signal input predecessorKey;
    // Predecessor next-key pointer before splicing in this commitment (insert).
    signal input predecessorNextKey;
    // Predecessor live-ballot leaf value (insert).
    signal input predecessorValue;
    // Merkle path for the predecessor leaf (insert).
    signal input predecessorPath[LIVE_TREE_DEPTH];

    // Chain hash after this slot.
    signal output newChainHash;
    // Live-ballot tree root after this slot.
    signal output newLiveRoot;
    // Tally accumulator C1 points after this slot.
    signal output newAccumulatorC1[VOTE_OPTIONS][2];
    // Tally accumulator C2 points after this slot.
    signal output newAccumulatorC2[VOTE_OPTIONS][2];

    // Verify that isNew is boolean and dummy slots are not inserts.
    isNew * (isNew - 1) === 0;
    (1 - isReal) * isNew === 0;

    signal enabledInsert <== isReal * isNew;
    signal enabledUpdate <== isReal * (1 - isNew);
    signal oldMustBeIdentity <== (1 - isReal) + enabledInsert;

    // Verify that a real Ballot has a nonzero user commitment.
    signal commitmentZero <== IsZero()(userCommitment);
    isReal * commitmentZero === 0;

    component newValue = LiveBallotValue(VOTE_OPTIONS);
    newValue.c1 <== encryptedVotesC1;
    newValue.c2 <== encryptedVotesC2;

    component oldValue = LiveBallotValue(VOTE_OPTIONS);
    oldValue.c1 <== oldEncryptedVotesC1;
    oldValue.c2 <== oldEncryptedVotesC2;

    // Dummy and insert: previous ciphertext is the curve identity (0, 1).
    // Dummy: new ciphertext is also the identity.
    component oldIdentityC1[VOTE_OPTIONS][2];
    component oldIdentityC2[VOTE_OPTIONS][2];
    component newIdentityC1[VOTE_OPTIONS][2];
    component newIdentityC2[VOTE_OPTIONS][2];

    for (var option = 0; option < VOTE_OPTIONS; option += 1) {
        // Identity is (0, 1); the axis index is that coordinate.
        for (var axis = 0; axis < 2; axis += 1) {
            oldIdentityC1[option][axis] = ForceEqualIfEnabled();
            oldIdentityC1[option][axis].enabled <== oldMustBeIdentity;
            oldIdentityC1[option][axis].in[0] <== oldEncryptedVotesC1[option][axis];
            oldIdentityC1[option][axis].in[1] <== axis;

            oldIdentityC2[option][axis] = ForceEqualIfEnabled();
            oldIdentityC2[option][axis].enabled <== oldMustBeIdentity;
            oldIdentityC2[option][axis].in[0] <== oldEncryptedVotesC2[option][axis];
            oldIdentityC2[option][axis].in[1] <== axis;

            newIdentityC1[option][axis] = ForceEqualIfEnabled();
            newIdentityC1[option][axis].enabled <== 1 - isReal;
            newIdentityC1[option][axis].in[0] <== encryptedVotesC1[option][axis];
            newIdentityC1[option][axis].in[1] <== axis;

            newIdentityC2[option][axis] = ForceEqualIfEnabled();
            newIdentityC2[option][axis].enabled <== 1 - isReal;
            newIdentityC2[option][axis].in[0] <== encryptedVotesC2[option][axis];
            newIdentityC2[option][axis].in[1] <== axis;
        }
    }

    // Bind the Ballot hash (same Poseidon(6) as the Ballot circuit).
    component totalC1 = CalculateTotalPoints(VOTE_OPTIONS);
    totalC1.points <== encryptedVotesC1;
    component totalC2 = CalculateTotalPoints(VOTE_OPTIONS);
    totalC2.points <== encryptedVotesC2;

    component ballotHash = Poseidon(6);
    ballotHash.inputs[0] <== pollId;
    ballotHash.inputs[1] <== userCommitment;
    ballotHash.inputs[2] <== totalC1.out[0];
    ballotHash.inputs[3] <== totalC1.out[1];
    ballotHash.inputs[4] <== totalC2.out[0];
    ballotHash.inputs[5] <== totalC2.out[1];

    // Absorb the Ballot hash into the chain hash only when the slot is real.
    component chainHash = Poseidon(2);
    chainHash.inputs[0] <== currentChainHash;
    chainHash.inputs[1] <== ballotHash.out;

    component chainMux = Mux1();
    chainMux.c[0] <== currentChainHash;
    chainMux.c[1] <== chainHash.out;
    chainMux.s <== isReal;
    newChainHash <== chainMux.out;

    // Insert: predecessorKey < userCommitment < predecessorNextKey
    // (predecessorNextKey = 0 means end of the sorted list).
    signal nextKeyIsZero <== IsZero()(predecessorNextKey);
    signal predecessorLessThanUser <== LessThanField()([predecessorKey, userCommitment]);
    signal userLessThanPredecessorNext <== LessThanField()([userCommitment, predecessorNextKey]);
    signal notEndAndLess <== (1 - nextKeyIsZero) * userLessThanPredecessorNext;
    signal nextOk <== nextKeyIsZero + notEndAndLess;
    signal gapOk <== predecessorLessThanUser * nextOk;

    component checkGap = ForceEqualIfEnabled();
    checkGap.enabled <== enabledInsert;
    checkGap.in[0] <== gapOk;
    checkGap.in[1] <== 1;

    component checkInsertNext = ForceEqualIfEnabled();
    checkInsertNext.enabled <== enabledInsert;
    checkInsertNext.in[0] <== leafNextKey;
    checkInsertNext.in[1] <== predecessorNextKey;

    signal oldPredecessorLeaf <== Poseidon(3)([predecessorKey, predecessorNextKey, predecessorValue]);
    signal newPredecessorLeaf <== Poseidon(3)([predecessorKey, userCommitment, predecessorValue]);
    signal newUserLeaf <== Poseidon(3)([userCommitment, predecessorNextKey, newValue.out]);
    signal oldUserLeaf <== Poseidon(3)([userCommitment, leafNextKey, oldValue.out]);
    signal updatedUserLeaf <== Poseidon(3)([userCommitment, leafNextKey, newValue.out]);

    // Insert: update the predecessor next-key, then write the new leaf in an empty slot.
    component predecessorUpdate = MerkleUpdate(LIVE_TREE_DEPTH);
    predecessorUpdate.enabled <== enabledInsert;
    predecessorUpdate.oldRoot <== currentLiveRoot;
    predecessorUpdate.oldLeaf <== oldPredecessorLeaf;
    predecessorUpdate.newLeaf <== newPredecessorLeaf;
    predecessorUpdate.index <== predecessorIndex;
    predecessorUpdate.siblings <== predecessorPath;

    component slotInsert = MerkleUpdate(LIVE_TREE_DEPTH);
    slotInsert.enabled <== enabledInsert;
    slotInsert.oldRoot <== predecessorUpdate.newRoot;
    slotInsert.oldLeaf <== 0;
    slotInsert.newLeaf <== newUserLeaf;
    slotInsert.index <== leafIndex;
    slotInsert.siblings <== slotPath;

    // Update: rewrite the existing live leaf for this user commitment.
    component userUpdate = MerkleUpdate(LIVE_TREE_DEPTH);
    userUpdate.enabled <== enabledUpdate;
    userUpdate.oldRoot <== currentLiveRoot;
    userUpdate.oldLeaf <== oldUserLeaf;
    userUpdate.newLeaf <== updatedUserLeaf;
    userUpdate.index <== leafIndex;
    userUpdate.siblings <== leafPath;

    component insertOrUpdateRoot = Mux1();
    insertOrUpdateRoot.c[0] <== userUpdate.newRoot;
    insertOrUpdateRoot.c[1] <== slotInsert.newRoot;
    insertOrUpdateRoot.s <== isNew;

    component liveMux = Mux1();
    liveMux.c[0] <== currentLiveRoot;
    liveMux.c[1] <== insertOrUpdateRoot.out;
    liveMux.s <== isReal;
    newLiveRoot <== liveMux.out;

    // Accumulator := previous - old live ciphertext + new ciphertext.
    component accMinusOldC1[VOTE_OPTIONS];
    component accPlusNewC1[VOTE_OPTIONS];
    component accMinusOldC2[VOTE_OPTIONS];
    component accPlusNewC2[VOTE_OPTIONS];

    for (var option = 0; option < VOTE_OPTIONS; option += 1) {
        accMinusOldC1[option] = BabyAdd();
        accMinusOldC1[option].x1 <== currentAccumulatorC1[option][0];
        accMinusOldC1[option].y1 <== currentAccumulatorC1[option][1];
        accMinusOldC1[option].x2 <== -oldEncryptedVotesC1[option][0];
        accMinusOldC1[option].y2 <== oldEncryptedVotesC1[option][1];

        accPlusNewC1[option] = BabyAdd();
        accPlusNewC1[option].x1 <== accMinusOldC1[option].xout;
        accPlusNewC1[option].y1 <== accMinusOldC1[option].yout;
        accPlusNewC1[option].x2 <== encryptedVotesC1[option][0];
        accPlusNewC1[option].y2 <== encryptedVotesC1[option][1];

        newAccumulatorC1[option] <== [accPlusNewC1[option].xout, accPlusNewC1[option].yout];

        accMinusOldC2[option] = BabyAdd();
        accMinusOldC2[option].x1 <== currentAccumulatorC2[option][0];
        accMinusOldC2[option].y1 <== currentAccumulatorC2[option][1];
        accMinusOldC2[option].x2 <== -oldEncryptedVotesC2[option][0];
        accMinusOldC2[option].y2 <== oldEncryptedVotesC2[option][1];

        accPlusNewC2[option] = BabyAdd();
        accPlusNewC2[option].x1 <== accMinusOldC2[option].xout;
        accPlusNewC2[option].y1 <== accMinusOldC2[option].yout;
        accPlusNewC2[option].x2 <== encryptedVotesC2[option][0];
        accPlusNewC2[option].y2 <== encryptedVotesC2[option][1];

        newAccumulatorC2[option] <== [accPlusNewC2[option].xout, accPlusNewC2[option].yout];
    }
}
