use starknet::ContractAddress;

/// Interface for policy checkers.
///
/// Provides a mechanism for determining whether a subject satisfies the
/// conditions required by a policy.
#[starknet::interface]
pub trait IChecker<TContractState> {
    /// Checks whether a subject satisfies the policy.
    ///
    /// The checker evaluates the subject using the supplied evidence and
    /// returns whether the check was successful.
    ///
    /// Arguments:
    /// - `subject`: Contract address of the subject being checked.
    /// - `evidence`: Evidence supplied for the policy check.
    ///
    /// Returns:
    /// - `true` if the subject satisfies the policy.
    /// - `false` otherwise.
    fn check(self: @TContractState, subject: ContractAddress, evidence: ByteArray) -> bool;
}
