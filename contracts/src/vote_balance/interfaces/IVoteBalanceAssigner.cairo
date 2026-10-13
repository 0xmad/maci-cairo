use crate::public_key::PublicKey;

/// Interface for vote-balance assigners.
///
/// MACI calls this at Signup to obtain the vote balance bound into the
/// state-tree leaf. Implementations are read-only. MACI passes the user
/// public key being registered.
#[starknet::interface]
pub trait IVoteBalanceAssigner<TContractState> {
    /// Returns the vote balance to bind for this Signup.
    ///
    /// Arguments:
    /// - `user_public_key`: User public key being registered.
    /// - `evidence`: Evidence supplied at Signup.
    ///
    /// Returns:
    /// - The vote balance for this Signup.
    fn get(self: @TContractState, user_public_key: PublicKey, evidence: ByteArray) -> u256;
}
