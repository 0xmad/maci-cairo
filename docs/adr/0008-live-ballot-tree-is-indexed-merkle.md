# Live-ballot tree is an indexed Merkle tree

The live-ballot tree is an indexed Merkle tree ordered by user commitment so
membership, non-membership, and last-wins updates fit in a small depth
(capacity, not key width). It is not the state tree, not a LeanIMT, and not
a bit-sparse tree on truncated commitment bits. There is no padding leaf;
empty means zero live Ballots. Real slots require a nonzero user commitment
so the key cannot collide with an empty leaf. A live leaf value is a
Poseidon(2) fold of per-option ciphertext hashes (not `Poseidon(n)`, which
stops at 16 inputs), not the ballot hash (which sums options).
