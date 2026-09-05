use starknet::{ClassHash, ContractAddress};


/// Arguments the Coordinator passes to MACI to create a Poll.
#[derive(Drop, Copy, Serde)]
pub struct CreatePollArgs {
    /// Timestamp at which the poll starts.
    pub start_date: u64,
    /// Timestamp at which the poll ends.
    pub end_date: u64,
    /// Public key used for encrypting votes in the poll.
    pub poll_public_key: (u256, u256),
    /// Depth of the state tree used by the poll.
    pub state_tree_depth: u8,
    /// Number of available vote options for the poll.
    pub vote_options: u256,
    /// Maximum Ballots consumed by one tally batch.
    pub batch_size: u32,
    /// Merkle root of the empty live-ballot tree for this poll's tally.
    pub empty_live_ballot_root: u256,
}

/// Arguments used to initialize a Poll contract at deploy time.
///
/// MACI fills `maci` and `poll_id` before asking the factory to deploy.
#[derive(Drop, Copy, Serde)]
pub struct PollConstructorArgs {
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
    /// MACI-assigned identifier of this poll.
    pub poll_id: u256,
    /// Maximum Ballots consumed by one tally batch.
    pub batch_size: u32,
    /// Merkle root of the empty live-ballot tree for this poll's tally.
    pub empty_live_ballot_root: u256,
}

/// Interface for interacting with the MACI poll factory.
///
/// Provides functionality for deploying polls and retrieving the poll
/// contract class hash used by the factory.
#[starknet::interface]
pub trait IPollFactory<TContractState> {
    /// Deploys a new MACI poll.
    ///
    /// Only the MACI contract that deployed this factory may call this
    /// function. The poll is deployed using the configured poll class hash
    /// and initialized with the provided constructor arguments.
    fn create_poll(ref self: TContractState, args: PollConstructorArgs) -> ContractAddress;

    /// Returns the class hash used to deploy poll contracts.
    fn get_poll_class_hash(self: @TContractState) -> ClassHash;
}

/// Errors returned by the poll factory.
pub mod Errors {
    /// Caller is not the MACI that deployed this factory.
    pub const NOT_MACI: felt252 = 'Caller is not MACI';
    /// Schedule end is not after start, vote options is zero, or batch size is
    /// zero.
    pub const INVALID_POLL_CONFIG: felt252 = 'Invalid poll config';
}

/// Rejects a Poll with an empty schedule, zero vote options, or zero batch
/// size.
pub fn assert_poll_config(start_date: u64, end_date: u64, vote_options: u256, batch_size: u32) {
    assert(end_date > start_date, Errors::INVALID_POLL_CONFIG);
    assert(vote_options != 0, Errors::INVALID_POLL_CONFIG);
    assert(batch_size != 0, Errors::INVALID_POLL_CONFIG);
}

/// MACI poll factory contract.
///
/// Deploys Poll contracts for the MACI instance that created this factory.
#[starknet::contract]
pub mod PollFactory {
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::syscalls::deploy_syscall;
    use starknet::{ClassHash, ContractAddress, SyscallResultTrait, get_caller_address};

    /// Persistent state for the poll factory.
    #[storage]
    struct Storage {
        /// Class hash of the poll contract used for new deployments.
        class_hash: ClassHash,
        /// MACI contract that deployed this factory and may create polls.
        maci: ContractAddress,
    }

    /// Initializes the poll factory.
    ///
    /// Stores the poll class hash and records the deployer as MACI.
    #[constructor]
    fn constructor(ref self: ContractState, class_hash: ClassHash) {
        self.class_hash.write(class_hash);
        self.maci.write(get_caller_address());
    }

    #[abi(embed_v0)]
    impl IPollFactoryImplementation of super::IPollFactory<ContractState> {
        /// Deploys a new MACI poll.
        ///
        /// The poll is deployed using the stored poll class hash and
        /// initialized with the configuration provided in `args`.
        fn create_poll(
            ref self: ContractState, args: super::PollConstructorArgs,
        ) -> starknet::ContractAddress {
            assert(get_caller_address() == self.maci.read(), super::Errors::NOT_MACI);

            let mut calldata = array![];
            args.serialize(ref calldata);

            let (contract_address, _) = deploy_syscall(
                self.class_hash.read(), 0, calldata.span(), false,
            )
                .unwrap_syscall();

            contract_address
        }

        /// Returns the class hash used to deploy poll contracts.
        fn get_poll_class_hash(self: @ContractState) -> ClassHash {
            self.class_hash.read()
        }
    }
}
