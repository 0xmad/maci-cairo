pragma circom 2.2.3;

include "../elgamal/ElGamalDecryption.circom";

/*
 * Decrypts one ElGamal ciphertext for each vote option.
 *
 * The circuit applies `ElGamalDecryption` independently to each pair of
 * ciphertext points (`c1` and `c2`) using the same private key.
 *
 * @param VOTE_OPTIONS Number of vote options/ciphertexts to decrypt.
 */
template VotesDecryption(VOTE_OPTIONS) {
    // Private input
    // The ElGamal private key used to decrypt all ciphertexts.
    signal input privateKey;

    // Public inputs
    // ElGamal ciphertext points for each vote option.
    signal input c1[VOTE_OPTIONS][2];
    signal input c2[VOTE_OPTIONS][2];

    // Decrypted output point for each vote option.
    signal output out[VOTE_OPTIONS][2];

    component elGamalDecryption[VOTE_OPTIONS];

    for (var index = 0; index < VOTE_OPTIONS; index += 1) {
        elGamalDecryption[index] = ElGamalDecryption();

        elGamalDecryption[index].c1 <== c1[index];
        elGamalDecryption[index].c2 <== c2[index];
        elGamalDecryption[index].privateKey <== privateKey;

        out[index] <== elGamalDecryption[index].out;
    }
}
