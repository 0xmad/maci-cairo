pragma circom 2.2.3;

include "./babyjub.circom";
include "./binary-merkle-root.circom";
include "./comparators.circom";
include "./poseidon.circom";

include "../utils/CalculateTotal.circom";
include "../utils/PrivateToPublicKey.circom";
include "../vote/VotesEncryption.circom";

/// Proves that a user's ballot is valid and that its votes are correctly
/// encrypted under the poll's public key.
///
/// The circuit verifies:
/// - The user's public key is a valid BabyJubJub point.
/// - The supplied public key corresponds to the user's private key.
/// - The user's commitment is derived from their private key and poll ID.
/// - The total number of votes does not exceed the user's vote balance.
/// - The user's state-tree leaf and path resolve to the supplied root.
/// - Each vote is correctly encrypted using fresh randomness and the poll's
///   public key.
///
/// @param STATE_TREE_DEPTH Depth of the user's state Merkle tree.
/// @param VOTE_OPTIONS Number of vote options in the ballot.
template Ballot(STATE_TREE_DEPTH, VOTE_OPTIONS) {
    // Private inputs
    // Cleartext votes
    signal input votes[VOTE_OPTIONS];
    // Random scalars corresponding to each vote option
    signal input random[VOTE_OPTIONS];
    // User private key
    signal input userPrivateKey;
    // User public key
    signal input userPublicKey[2];
    // User votes balance
    signal input userVotesBalance;
    // User Merkle state tree index
    signal input userTreeIndex;
    // User Merkle tree path elements
    signal input userTreePathElements[STATE_TREE_DEPTH];

    // Public inputs
    // User state tree root
    signal input userTreeRoot;
    // Poll ID
    signal input pollId;
    // User commitment
    signal input userCommitment;
    // Poll public key
    signal input pollPublicKey[2];
    // Encrypted votes C1
    signal input encryptedVotesC1[VOTE_OPTIONS][2];
    // Encrypted votes C2
    signal input encryptedVotesC2[VOTE_OPTIONS][2];

    // Verify that the user's public key is a valid BabyJubJub point.
    component babyCheck = BabyCheck();
    babyCheck.x <== userPublicKey[0];
    babyCheck.y <== userPublicKey[1];

    // Verify that the user's public key is derived from their private key.
    component privateToPublic = PrivateToPublicKey();
    privateToPublic.privateKey <== userPrivateKey;
    privateToPublic.publicKey === userPublicKey;

    // Verify the user's poll-specific commitment.
    //
    // TODO: Review whether exposing the identity through the relationship
    // between the public key and commitment can be avoided.
    signal commitment <== Poseidon(2)([userPrivateKey, pollId]);
    userCommitment === commitment;

    // Verify that the total number of votes is within the user's balance.
    signal totalVotes <== CalculateTotal(VOTE_OPTIONS)(votes);
    signal isLessEqThan <== LessEqThan(251)([totalVotes, userVotesBalance]);
    isLessEqThan === 1;

    // Verify the user's membership in the state Merkle tree.
    component merkle = BinaryMerkleRoot(STATE_TREE_DEPTH);
    merkle.leaf <== Poseidon(3)([
        userPublicKey[0],
        userPublicKey[1],
        userVotesBalance
    ]);
    merkle.siblings <== userTreePathElements;
    merkle.index <== userTreeIndex;
    merkle.depth <== STATE_TREE_DEPTH;

    userTreeRoot === merkle.out;

    // Encrypt each vote using the poll's public key and its corresponding
    // random scalar.
    component voteEncryption = VotesEncryption(VOTE_OPTIONS);
    voteEncryption.votes <== votes;
    voteEncryption.random <== random;
    voteEncryption.publicKey <== pollPublicKey;

    // Bind the supplied ciphertexts to the ciphertexts produced by the
    // encryption circuit.
    for (var index = 0; index < VOTE_OPTIONS; index += 1) {
        encryptedVotesC1[index][0] === voteEncryption.c1[index][0];
        encryptedVotesC1[index][1] === voteEncryption.c1[index][1];
        encryptedVotesC2[index][0] === voteEncryption.c2[index][0];
        encryptedVotesC2[index][1] === voteEncryption.c2[index][1];
    }
}
