pragma circom 2.2.3;

include "../elgamal/ElGamalEncryption.circom";

/*
 * Encrypts one vote for each vote option using ElGamal encryption.
 *
 * Each vote is encrypted independently with its corresponding random scalar,
 * while all votes use the same public key.
 *
 * @param VOTE_OPTIONS Number of votes/vote options to encrypt.
 */
template VotesEncryption(VOTE_OPTIONS) {
    // Private inputs
    // Votes
    signal input votes[VOTE_OPTIONS];
    // Random scalars for corresponding votes 
    signal input random[VOTE_OPTIONS];

    // Public input
    // ElGamal public key used to encrypt every vote.
    signal input publicKey[2];

    // ElGamal ciphertexts for each vote, represented as pairs of points.
    signal output c1[VOTE_OPTIONS][2];
    signal output c2[VOTE_OPTIONS][2];

    component elGamalEncryption[VOTE_OPTIONS];

    for (var index = 0; index < VOTE_OPTIONS; index += 1) {
        elGamalEncryption[index] = ElGamalEncryption();

        elGamalEncryption[index].publicKey <== publicKey;
        elGamalEncryption[index].message <== votes[index];
        elGamalEncryption[index].random <== random[index];

        c1[index] <== elGamalEncryption[index].c1;
        c2[index] <== elGamalEncryption[index].c2;
    }
}