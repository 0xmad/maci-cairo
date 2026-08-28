use starknet::ContractAddress;

/// Interface for vote-balance assigners.
///
/// MACI calls this at Signup to obtain the vote balance bound into the
/// state-tree leaf. Implementations are read-only.
#[starknet::interface]
pub trait IVoteBalanceAssigner<TContractState> {
    /// Returns the vote balance to bind for a Subject.
    ///
    /// Arguments:
    /// - `subject`: Contract address of the Subject signing up.
    /// - `evidence`: Evidence supplied at Signup.
    ///
    /// Returns:
    /// - The vote balance for this Subject.
    fn get(self: @TContractState, subject: ContractAddress, evidence: ByteArray) -> u256;
}
