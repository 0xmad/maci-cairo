use starknet::ContractAddress;

/// Errors returned by enforcers.
pub mod Errors {
    /// The configured checker rejected the subject.
    pub const UNSUCCESSFUL_CHECK: felt252 = 'Unsuccessful check';

    /// The subject has already been successfully enforced.
    pub const ALREADY_ENFORCED: felt252 = 'Already enforced';
}

/// Interface for policy enforcers.
///
/// Provides functionality for enforcing a policy on a subject, configuring
/// the target of the enforcer, and retrieving the enforcer's name.
#[starknet::interface]
pub trait IEnforcer<TContractState> {
    /// Enforces the policy for a subject.
    ///
    /// The enforcer validates the subject using the supplied evidence and
    /// applies the policy if the check is successful.
    ///
    /// Arguments:
    /// - `subject`: Contract address of the subject to enforce.
    /// - `evidence`: Evidence supplied for the policy check.
    ///
    /// Errors:
    /// - `UNSUCCESSFUL_CHECK`: The configured checker rejected the subject.
    /// - `ALREADY_ENFORCED`: The subject has already been successfully enforced.
    fn enforce(ref self: TContractState, subject: ContractAddress, evidence: ByteArray);

    /// Sets the target address for the enforcer.
    ///
    /// The target is used to configure or transfer control of the enforcer,
    /// depending on the implementation.
    ///
    /// Arguments:
    /// - `target`: Address of the new target.
    fn set_target(ref self: TContractState, target: ContractAddress);

    /// Returns the name of the enforcer.
    ///
    /// Returns:
    /// - A human-readable name identifying the enforcer implementation.
    fn name(self: @TContractState) -> ByteArray;
}
