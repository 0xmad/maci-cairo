pragma circom 2.2.3;

include "./babyjub.circom";
include "./bitify.circom";
include "./escalarmulany.circom";
include "./escalarmulfix.circom";

/*
 * Encrypts a message using ElGamal encryption on the BabyJubJub curve.
 *
 * Given a message `m`, random scalar `r`, and public key `A`, computes:
 *
 *   c1 = rG
 *   c2 = mG + rA
 *
 * where `G` is the BabyJubJub base point and `mG` is the curve point
 * representing the encoded message.
 */
template ElGamalEncryption() {
    // BabyJubJub base point in affine coordinates.
    var BASE8[2] = [
        5299619240641551281634865583518297030282874472190772894086521144482721001553,
        16950150798460657717958625567821834550301663161624707787222815936182638968203
    ];

    // Private inputs
    // Random scalar
    signal input random;
    // Message to encrypt
    signal input message;

    // Public input
    // ElGamal public key.
    signal input publicKey[2];

    // ElGamal ciphertext:
    // c1 = random * G
    // c2 = message * G + random * publicKey
    signal output c1[2];
    signal output c2[2];

    // Verify that the supplied public key is a valid BabyJubJub point.
    component babyCheck = BabyCheck();
    babyCheck.x <== publicKey[0];
    babyCheck.y <== publicKey[1];

    // Decompose the scalar inputs into bits for scalar multiplication.
    signal randomBits[253] <== Num2Bits(253)(random);
    signal messageBits[253] <== Num2Bits(253)(message);

    // Compute random * G.
    component rG = EscalarMulFix(253, BASE8);
    rG.e <== randomBits;

    // Compute message * G.
    component mG = EscalarMulFix(253, BASE8);
    mG.e <== messageBits;

    // Compute random * publicKey.
    component rA = EscalarMulAny(253);
    rA.e <== randomBits;
    rA.p <== publicKey;

    // Compute message * G + random * publicKey.
    component babyAdd = BabyAdd();
    babyAdd.x1 <== mG.out[0];
    babyAdd.y1 <== mG.out[1];
    babyAdd.x2 <== rA.out[0];
    babyAdd.y2 <== rA.out[1];

    c1 <== rG.out;
    c2 <== [babyAdd.xout, babyAdd.yout];
}