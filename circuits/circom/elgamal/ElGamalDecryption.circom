pragma circom 2.2.3;

include "babyjub.circom";
include "bitify.circom";
include "escalarmulany.circom";

/*
 * Decrypts an ElGamal ciphertext on the BabyJubJub curve.
 *
 * Given a ciphertext `(c1, c2)` and private key `x`, computes:
 *
 *   mG = c2 - x * c1
 *
 * where `mG` is the elliptic-curve point representing the plaintext
 * message multiplied by the generator.
 */
template ElGamalDecryption() {
    // Private input
    // ElGamal private key.
    signal input privateKey;

    // Public inputs
    // ElGamal ciphertext points.
    signal input c1[2];
    signal input c2[2];

    // Decrypted message point mG.
    signal output out[2];

    // Decompose the private key into 253 bits for scalar multiplication.
    signal bits[253] <== Num2Bits(253)(privateKey);

    // Compute privateKey * c1.
    component xC1 = EscalarMulAny(253);
    xC1.e <== bits;
    xC1.p <== c1;

    // Subtract privateKey * c1 from c2 to recover the message point.
    component mG = BabyAdd();
    mG.x1 <== c2[0];
    mG.y1 <== c2[1];
    mG.x2 <== -xC1.out[0];
    mG.y2 <== xC1.out[1];

    out <== [mG.xout, mG.yout];
}
