use starknet::{ClassHash, ContractAddress};


/// Arguments required to create a new MACI poll.
#[derive(Drop, Serde)]
pub struct CreatePollArgs {
    /// Timestamp at which the poll starts.
    pub start_date: u64,
    /// Timestamp at which the poll ends.
    pub end_date: u64,
    /// Public key used for encrypting votes in the poll.
    pub poll_public_key: (u256, u256),
    /// Address of the MACI contract associated with the poll.
    pub maci: ContractAddress,
    /// Depth of the state tree used by the poll.
    pub state_tree_depth: u8,
    /// Number of available vote options for the poll.
    pub vote_options: u256,
}

/// Interface for interacting with the MACI poll factory.
///
/// Provides functionality for deploying polls and retrieving the poll
/// contract class hash used by the factory.
#[starknet::interface]
pub trait IPollFactory<TContractState> {
    /// Deploys a new MACI poll.
    ///
    /// The poll is deployed using the configured poll class hash and
    /// initialized with the provided configuration.
    fn create_poll(ref self: TContractState, args: CreatePollArgs) -> ContractAddress;

    /// Returns the class hash used to deploy poll contracts.
    fn get_poll_class_hash(self: @TContractState) -> ClassHash;
}

/// MACI poll factory contract.
///
/// Manages the deployment of MACI poll contracts using a configured poll
/// class hash. Each newly deployed poll is reported through the
/// [`PollCreated`] event.
#[starknet::contract]
pub mod PollFactory {
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::syscalls::deploy_syscall;
    use starknet::{ClassHash, ContractAddress, SyscallResultTrait};

    /// Persistent state for the poll factory.
    #[storage]
    struct Storage {
        /// Class hash of the poll contract used for new deployments.
        class_hash: ClassHash,
    }

    /// Events emitted by the poll factory.
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        PollCreated: PollCreated,
    }

    /// Event emitted when a new poll is deployed.
    ///
    /// Contains the address of the newly deployed poll contract.
    #[derive(Drop, starknet::Event)]
    pub struct PollCreated {
        /// Address of the newly deployed poll contract.
        pub contract_address: ContractAddress,
    }

    /// Initializes the poll factory.
    ///
    /// Stores the class hash that will be used to deploy new poll contracts.
    #[constructor]
    fn constructor(ref self: ContractState, class_hash: ClassHash) {
        self.class_hash.write(class_hash);
    }

    #[abi(embed_v0)]
    impl IPollFactoryImplementation of super::IPollFactory<ContractState> {
        /// Deploys a new MACI poll.
        ///
        /// The poll is deployed using the stored poll class hash and
        /// initialized with the configuration provided in `args`.
        ///
        /// A [`PollCreated`] event is emitted with the address of the
        /// newly deployed poll.
        fn create_poll(
            ref self: ContractState, args: super::CreatePollArgs,
        ) -> starknet::ContractAddress {
            let mut calldata = array![];
            (
                args.start_date,
                args.end_date,
                args.poll_public_key,
                args.maci,
                args.state_tree_depth,
                args.vote_options,
            )
                .serialize(ref calldata);

            let (contract_address, _) = deploy_syscall(
                self.class_hash.read(), 0, calldata.span(), false,
            )
                .unwrap_syscall();

            self.emit(Event::PollCreated(PollCreated { contract_address }));

            contract_address
        }

        /// Returns the class hash used to deploy poll contracts.
        fn get_poll_class_hash(self: @ContractState) -> ClassHash {
            self.class_hash.read()
        }
    }
}
