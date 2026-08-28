/// Assigns the same vote balance to every Subject.
pub mod ConstantInitialVoteBalance;
/// Vote-balance assignment: the vote balance bound into a Signup leaf.
///
/// Eligibility stays on Policy. New assignment rules are new implementations
/// of this role.
pub mod interfaces;
