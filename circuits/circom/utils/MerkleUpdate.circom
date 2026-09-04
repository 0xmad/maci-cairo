pragma circom 2.2.3;

include "binary-merkle-root.circom";
include "comparators.circom";

/// Replaces `oldLeaf` at `index` with `newLeaf` in a Poseidon binary Merkle
/// tree of fixed `DEPTH` (same parent hash as the Ballot state-tree path).
///
/// The circuit verifies:
/// - When `enabled` is 1, `oldLeaf` and `siblings` reconstruct `oldRoot`.
/// - `newRoot` is the root of the same path with `newLeaf` in that slot.
/// - When `enabled` is 0, the old-root check is skipped (dummy / unused
///   insert-or-update branch). `newRoot` is still computed and must be
///   ignored by the caller.
///
/// @param DEPTH Tree depth (number of siblings / path bits).
template MerkleUpdate(DEPTH) {
    // 1 to enforce membership of oldLeaf under oldRoot; 0 to skip that check.
    signal input enabled;
    // Merkle root before the replacement.
    signal input oldRoot;
    // Current leaf at index.
    signal input oldLeaf;
    // Replacement leaf at the same index.
    signal input newLeaf;
    // Leaf index (path bits, LSB first, as in BinaryMerkleRoot).
    signal input index;
    // Sibling hashes along the path.
    signal input siblings[DEPTH];
    // Merkle root after putting newLeaf at index.
    signal output newRoot;

    // Verify oldLeaf membership when enabled.
    component oldMerkle = BinaryMerkleRoot(DEPTH);
    oldMerkle.leaf <== oldLeaf;
    oldMerkle.depth <== DEPTH;
    oldMerkle.index <== index;
    oldMerkle.siblings <== siblings;

    // Same siblings and index: only the leaf changes.
    component newMerkle = BinaryMerkleRoot(DEPTH);
    newMerkle.leaf <== newLeaf;
    newMerkle.depth <== DEPTH;
    newMerkle.index <== index;
    newMerkle.siblings <== siblings;

    component checkOldRoot = ForceEqualIfEnabled();
    checkOldRoot.enabled <== enabled;
    checkOldRoot.in[0] <== oldMerkle.out;
    checkOldRoot.in[1] <== oldRoot;

    newRoot <== newMerkle.out;
}
