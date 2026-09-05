pragma circom 2.2.3;

include "../utils/PrivateToPublicKey.circom";
include "../vote/VotesDecryption.circom";

/// Opens a tally accumulator to tally totals under the poll private key.
/// This circuit does not consume Ballots, the chain hash, or the live-ballot
/// tree. The verifier binds it to a Poll by checking that the accumulator
/// matches the last TallyBatch. Poll also requires every chain-hash
/// checkpoint to have been processed before this proof is accepted.
///
/// The circuit verifies:
/// - The poll public key is derived from the poll private key.
/// - Decrypting each per-option accumulator ciphertext yields the message
///   point `mG`.
/// - Each public tally total `T[i]` satisfies `T[i] * G == mG` (discrete
///   log of the decrypted aggregate for that vote option).
///
/// @param VOTE_OPTIONS Number of vote options in the accumulator.
template TallyFinalize(VOTE_OPTIONS) {
    // Private inputs
    // Poll private key matching the poll public key; opens the aggregate only.
    signal input pollPrivateKey;

    // Public inputs
    // Poll public key used to encrypt Votes.
    signal input pollPublicKey[2];
    // Tally accumulator C1 points (homomorphic sum of live Ballots).
    signal input accumulatorC1[VOTE_OPTIONS][2];
    // Tally accumulator C2 points (homomorphic sum of live Ballots).
    signal input accumulatorC2[VOTE_OPTIONS][2];
    // Public integer amount per vote option after Tally.
    signal input tallyTotals[VOTE_OPTIONS];

    // Verify that the poll public key is derived from the poll private key.
    component privateToPublic = PrivateToPublicKey();
    privateToPublic.privateKey <== pollPrivateKey;
    privateToPublic.publicKey === pollPublicKey;

    // Decrypt each per-option accumulator ciphertext to a message point mG.
    component decryption = VotesDecryption(VOTE_OPTIONS);
    decryption.privateKey <== pollPrivateKey;
    decryption.c1 <== accumulatorC1;
    decryption.c2 <== accumulatorC2;

    component totalPoint[VOTE_OPTIONS];

    for (var index = 0; index < VOTE_OPTIONS; index += 1) {
        // Bind tally total T[i] by T[i] * G == decrypted aggregate point.
        // Tally totals use the same scalar range as a BabyJub key so T * G
        // is unique for this slice.
        totalPoint[index] = PrivateToPublicKey();
        totalPoint[index].privateKey <== tallyTotals[index];
        decryption.out[index] === totalPoint[index].publicKey;
    }
}
