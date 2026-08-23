pragma circom 2.2.3;

include "./babyjub.circom";

/**
 * @title CalculateTotalPoints
 * @notice Validates and calculates the sum of multiple Baby Jubjub points.
 *
 * The circuit takes `length` Baby Jubjub points and computes their elliptic
 * curve sum:
 *
 *     P0 + P1 + ... + Pn-1
 *
 * where each point is represented as `[x, y]`.
 *
 * Every input point is validated using `BabyCheck()`. The points are then
 * added sequentially using `BabyAdd()`.
 *
 * For `length` input points, `length - 1` point additions are required:
 *
 *     P0 + P1
 *     (P0 + P1) + P2
 *     ((P0 + P1) + P2) + P3
 *     ...
 *
 * @param length Number of Baby Jubjub points to add. Must be at least 2.
 *
 * @input points `length` Baby Jubjub points, where each point is represented as `[x, y]`.
 *
 * @output out The resulting Baby Jubjub point `[x, y]`.
 */
template CalculateTotalPoints(length) {
    // At least two points are required because the circuit performs
    // pairwise point addition.
    assert(length >= 2);

    /**
     * Input Baby Jubjub points
     */
    signal input points[length][2];

    /**
     * Resulting Baby Jubjub point
     */
    signal output out[2];

    /**
     * Validate every input point.
     *
     * BabyCheck() ensures that each `(x, y)` pair represents a valid
     * Baby Jubjub point.
     */
    component babyCheck[length];

    for (var index = 0; index < length; index += 1) {
        babyCheck[index] = BabyCheck();
        babyCheck[index].x <== points[index][0];
        babyCheck[index].y <== points[index][1];
    }

    /**
     * For `length` points, exactly `length - 1` additions are required.
     *
     * The additions are performed from left to right:
     *
     *     babyAdd[0] = P0 + P1
     *     babyAdd[1] = babyAdd[0] + P2
     *     babyAdd[2] = babyAdd[1] + P3
     *     ...
     */
    component babyAdd[length - 1];

    /**
     * First addition: P0 + P1
     */
    babyAdd[0] = BabyAdd();
    babyAdd[0].x1 <== points[0][0];
    babyAdd[0].y1 <== points[0][1];
    babyAdd[0].x2 <== points[1][0];
    babyAdd[0].y2 <== points[1][1];

    /**
     * Add each remaining point to the accumulated result.
     *
     * For example, for four points:
     *
     *     babyAdd[0] = P0 + P1
     *     babyAdd[1] = babyAdd[0] + P2
     *     babyAdd[2] = babyAdd[1] + P3
     */
    for (var index = 1; index < length - 1; index += 1) {
        babyAdd[index] = BabyAdd();
        babyAdd[index].x1 <== babyAdd[index - 1].xout;
        babyAdd[index].y1 <== babyAdd[index - 1].yout;
        babyAdd[index].x2 <== points[index + 1][0];
        babyAdd[index].y2 <== points[index + 1][1];
    }

    /**
     * The final addition contains the sum of all input points
     */
    out <== [babyAdd[length - 2].xout, babyAdd[length - 2].yout];
}
