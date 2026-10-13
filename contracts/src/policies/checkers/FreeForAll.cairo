/// Checker that unconditionally approves every subject.
///
/// This checker does not impose any access restrictions and always returns
/// `true` from `check`, regardless of the subject or supplied evidence.
#[starknet::contract]
pub mod FreeForAllChecker {
    use crate::policies::interfaces::IChecker::IChecker;
    use crate::public_key::PublicKey;

    #[storage]
    struct Storage {}

    /// Public implementation of the checker interface.
    #[abi(embed_v0)]
    impl FreeForAllImplementation of IChecker<ContractState> {
        /// Checks whether a subject satisfies the policy.
        ///
        /// This implementation always approves the subject and does not
        /// evaluate the supplied evidence.
        ///
        /// Arguments:
        /// - `subject`: User public key being checked.
        /// - `evidence`: Evidence supplied for the policy check. It is ignored.
        ///
        /// Returns:
        /// - `true` for every subject.
        fn check(self: @ContractState, subject: PublicKey, evidence: ByteArray) -> bool {
            true
        }
    }
}
