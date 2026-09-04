pragma circom 2.2.3;

include "poseidon.circom";

/// Digest of one live Ballot's per-option ElGamal ciphertexts, used as the
/// value in a live-ballot tree leaf. This is not the ballot hash: the ballot
/// hash Poseidon(6)-compresses the *sum* of C1/C2 across options, which
/// cannot be subtracted per option from the tally accumulator.
///
/// Circomlib `Poseidon(n)` is only defined for `n <= 16`, so the leaf value
/// cannot be `Poseidon(VOTE_OPTIONS)` when there are many options (100+).
/// Each option is still `Poseidon(4)` over `(c1.x, c1.y, c2.x, c2.y)`. Those
/// hashes are absorbed left-to-right with `Poseidon(2)`, starting from `0`.
///
/// @param VOTE_OPTIONS Number of vote options in the Ballot.
template LiveBallotValue(VOTE_OPTIONS) {
    // Encrypted Votes C1 for each vote option.
    signal input c1[VOTE_OPTIONS][2];
    // Encrypted Votes C2 for each vote option.
    signal input c2[VOTE_OPTIONS][2];
    // Poseidon(2) fold of the per-option ciphertext hashes.
    signal output out;

    component optionHash[VOTE_OPTIONS];
    component absorb[VOTE_OPTIONS];
    signal acc[VOTE_OPTIONS + 1];

    acc[0] <== 0;

    for (var index = 0; index < VOTE_OPTIONS; index += 1) {
        optionHash[index] = Poseidon(4);
        optionHash[index].inputs[0] <== c1[index][0];
        optionHash[index].inputs[1] <== c1[index][1];
        optionHash[index].inputs[2] <== c2[index][0];
        optionHash[index].inputs[3] <== c2[index][1];

        absorb[index] = Poseidon(2);
        absorb[index].inputs[0] <== acc[index];
        absorb[index].inputs[1] <== optionHash[index].out;
        acc[index + 1] <== absorb[index].out;
    }

    out <== acc[VOTE_OPTIONS];
}
