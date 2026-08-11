/// Enforcer that grants access to subjects approved by a configured checker.
///
/// `FreeForAllEnforcer` uses an [`IChecker`] implementation to determine
/// whether a subject can be enforced. Once a subject has been successfully
/// enforced, it cannot be enforced again.
///
/// Ownership is managed through OpenZeppelin's `OwnableComponent`. Only the
/// owner can enforce subjects or transfer ownership through `set_target`.
#[starknet::contract]
pub mod FreeForAllEnforcer {
    use openzeppelin::access::ownable::OwnableComponent;
    use starknet::ContractAddress;
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use crate::policies::interfaces::IChecker::{
        ICheckerDispatcher, ICheckerDispatcherTrait,
    };
    use crate::policies::interfaces::IEnforcer::{Errors, IEnforcer};

    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);

    /// Persistent storage for the enforcer.
    #[storage]
    struct Storage {
        /// OpenZeppelin ownership component storage.
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        /// Dispatcher for the checker used to validate subjects.
        checker: ICheckerDispatcher,
        /// Tracks subjects that have already been successfully enforced.
        enforced_users: Map<ContractAddress, bool>,
    }

    /// Events emitted by the enforcer.
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        /// Events emitted by the OpenZeppelin ownership component.
        #[flat]
        OwnableEvent: OwnableComponent::Event,
    }

    /// Initializes the enforcer with a checker and the deploying account
    /// as the initial owner.
    ///
    /// Arguments:
    /// - `checker_address`: Address of the checker contract used to validate
    ///   subjects during enforcement.
    #[constructor]
    fn constructor(ref self: ContractState, checker_address: ContractAddress) {
        self.checker.write(ICheckerDispatcher { contract_address: checker_address });
        self.ownable.initializer(starknet::get_caller_address());
    }

    /// Public ownership implementation provided by OpenZeppelin.
    impl OwnableImplementation = OwnableComponent::OwnableMixinImpl<ContractState>;

    /// Internal ownership implementation provided by OpenZeppelin.
    impl OwnableInternalImplementation = OwnableComponent::InternalImpl<ContractState>;

    /// Public implementation of the enforcer interface.
    #[abi(embed_v0)]
    impl FreeForAllImplementation of IEnforcer<ContractState> {
        /// Sets the target owner of the enforcer.
        ///
        /// The ownership component performs the ownership transfer and
        /// enforces the relevant ownership restrictions.
        ///
        /// Arguments:
        /// - `target`: Address of the account that will become the new owner.
        fn set_target(ref self: ContractState, target: ContractAddress) {
            self.ownable.transfer_ownership(target);
        }

        /// Enforces a subject after validating it with the configured checker.
        ///
        /// The caller must be the current owner. A subject can only be
        /// successfully enforced once and must pass the configured checker.
        ///
        /// Arguments:
        /// - `subject`: Contract address of the subject to enforce.
        /// - `evidence`: Evidence supplied to the configured checker.
        ///
        /// Errors:
        /// - `ALREADY_ENFORCED`: The subject has already been enforced.
        /// - `UNSUCCESSFUL_CHECK`: The configured checker rejected the subject.
        /// - `NOT_OWNER`: The caller is not the current owner of the enforcer.
        fn enforce(
            ref self: ContractState,
            subject: starknet::ContractAddress,
            evidence: ByteArray,
        ) {
            self.ownable.assert_only_owner();
            assert(!self.enforced_users.read(subject), Errors::ALREADY_ENFORCED);
            assert(self.checker.read().check(subject, evidence), Errors::UNSUCCESSFUL_CHECK);

            self.enforced_users.write(subject, true);
        }

        /// Returns the name of this enforcer.
        ///
        /// Returns:
        /// - `FreeForAll`.
        fn name(self: @ContractState) -> ByteArray {
            "FreeForAll"
        }
    }
}
