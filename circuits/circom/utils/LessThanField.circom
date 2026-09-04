pragma circom 2.2.3;

include "bitify.circom";
include "comparators.circom";

/// True when `in[0] < in[1]` as BN254 field elements.
///
/// Circomlib `LessThan(n)` only allows `n <= 252`. User commitments (and
/// other Poseidon outputs) are full field elements, so a 252-bit compare
/// would be wrong or unsound. This template bit-decomposes both inputs
/// with `Num2Bits_strict` (254 bits, LSB-first) and compares from the MSB.
///
/// The circuit binds:
/// - `out = 1` iff the integer value of `in[0]` is strictly less than `in[1]`.
/// - `out = 0` if they are equal or `in[0]` is greater.
///
/// Used by TallyBatch insert to prove the live-ballot predecessor gap:
/// `predecessorKey < userCommitment < predecessorNextKey`.
template LessThanField() {
    // Values to compare; each must fit in 254 bits (the BN254 scalar field).
    signal input in[2];
    // 1 if in[0] < in[1]; otherwise 0.
    signal output out;

    signal bitsA[254] <== Num2Bits_strict()(in[0]);
    signal bitsB[254] <== Num2Bits_strict()(in[1]);

    component equalBit[254];
    signal stillEqual[255];
    signal isLess[255];
    signal aLessB[254];

    stillEqual[0] <== 1;
    isLess[0] <== 0;

    // Walk bits from MSB (index 253) down to LSB. The first position where
    // the bits differ decides the order; earlier equality is tracked in
    // stillEqual.
    for (var step = 0; step < 254; step += 1) {
        var bitIndex = 253 - step;

        equalBit[step] = IsEqual();
        equalBit[step].in[0] <== bitsA[bitIndex];
        equalBit[step].in[1] <== bitsB[bitIndex];

        aLessB[step] <== (1 - bitsA[bitIndex]) * bitsB[bitIndex];
        isLess[step + 1] <== isLess[step] + stillEqual[step] * aLessB[step];
        stillEqual[step + 1] <== stillEqual[step] * equalBit[step].out;
    }

    out <== isLess[254];
}
