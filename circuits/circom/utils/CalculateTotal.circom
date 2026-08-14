pragma circom 2.2.3;

/**
 * Computes the cumulative sum of an array of length input signals.
 * It iterates through each input, aggregating the sum up to that point,
 * and outputs the total sum of all inputs. This template is useful for
 * operations requiring the total sum of multiple signals, ensuring the
 * final output reflects the cumulative total of the inputs provided.
 */
template CalculateTotal(length) {
    // Array of values.
    signal input nums[length];
    // Total sum.
    signal output sum;

    signal sums[length];
    sums[0] <== nums[0];

    for (var index = 1; index < length; index += 1) {
        sums[index] <== sums[index - 1] + nums[index];
    }

    sum <== sums[length - 1];
}
