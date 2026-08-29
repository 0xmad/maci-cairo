/// A ballot submitted to a MACI poll.
///
/// Contains the ballot hash, the voter's commitment, encrypted vote data,
/// and the zero-knowledge proof used to validate the ballot.
#[derive(Drop, Copy, Serde)]
pub struct Ballot {
    /// Hash of the ballot.
    pub hash: u256,
    /// Commitment identifying the user submitting the ballot.
    ///
    /// TODO: Find a way to remove the user commitment.
    pub user_commitment: u256,
    /// First components of the encrypted votes.
    pub encrypted_votes_c1: Span<Span<u256>>,
    /// Second components of the encrypted votes.
    pub encrypted_votes_c2: Span<Span<u256>>,
    /// Zero-knowledge proof used to verify the ballot.
    pub proof: Span<u256>,
}

/// Interface for interacting with a MACI poll.
///
/// Provides functionality for submitting ballots and retrieving the current
/// poll chain hash.
#[starknet::interface]
pub trait IPoll<TContractState> {
    /// Submits a ballot to the poll.
    ///
    /// The ballot is validated and, if accepted, its hash is appended to the
    /// poll's chain hash and a [`Voted`] event is emitted.
    fn vote(ref self: TContractState, ballot: Ballot);

    /// Returns the current chain hash of the poll.
    ///
    /// The chain hash is updated whenever a ballot is successfully submitted.
    fn get_chain_hash(self: @TContractState) -> u256;
}

/// MACI poll contract.
///
/// Manages ballot submissions and maintains a cryptographic chain hash of
/// submitted ballots. Each accepted ballot is emitted through the [`Voted`]
/// event, allowing off-chain components to reconstruct the poll's ballot
/// history.
#[starknet::contract]
pub mod Poll {
    use maci_common::crypto::poseidon_bn254::poseidon2;
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use crate::MACI::IMACIDispatcher;
    use crate::PollFactory::CreatePollArgs;

    /// Persistent state for a MACI poll.
    #[storage]
    struct Storage {
        /// Address of the MACI contract associated with this poll.
        maci: IMACIDispatcher,
        /// Cryptographic chain hash of the ballots submitted to the poll.
        chain_hash: u256,
    }

    /// Events emitted by the poll contract.
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        Voted: Voted,
    }

    /// Event emitted when a ballot is submitted to the poll.
    ///
    /// Contains the ballot data and the resulting chain hash, allowing
    /// off-chain consumers to track the sequence of submitted ballots.
    #[derive(Drop, starknet::Event)]
    pub struct Voted {
        /// Hash of the submitted ballot.
        pub hash: u256,
        /// Commitment identifying the user who submitted the ballot.
        pub user_commitment: u256,
        /// First components of the encrypted votes.
        pub encrypted_votes_c1: Span<Span<u256>>,
        /// Second components of the encrypted votes.
        pub encrypted_votes_c2: Span<Span<u256>>,
        /// Chain hash after incorporating the submitted ballot.
        pub chain_hash: u256,
    }

    /// Initializes a new poll.
    ///
    /// Associates the poll with the MACI contract specified in `args`.
    #[constructor]
    fn constructor(ref self: ContractState, args: CreatePollArgs) {
        self.maci.write(IMACIDispatcher { contract_address: args.maci });
    }

    #[abi(embed_v0)]
    impl IPollImplementation of super::IPoll<ContractState> {
        /// Submits a ballot to the poll.
        ///
        /// The ballot hash is appended to the current chain hash using
        /// Poseidon:
        ///
        /// `new_chain_hash = Poseidon(current_chain_hash, ballot_hash)`
        ///
        /// The resulting chain hash is stored and a [`Voted`] event is emitted.
        fn vote(ref self: ContractState, ballot: super::Ballot) {
            // verify ballot
            let new_chain_hash: u256 = poseidon2(self.chain_hash.read(), ballot.hash);
            self.chain_hash.write(new_chain_hash);

            self
                .emit(
                    Event::Voted(
                        Voted {
                            hash: ballot.hash,
                            user_commitment: ballot.user_commitment,
                            encrypted_votes_c1: ballot.encrypted_votes_c1,
                            encrypted_votes_c2: ballot.encrypted_votes_c2,
                            chain_hash: new_chain_hash,
                        },
                    ),
                );
        }

        /// Returns the current cryptographic chain hash of the poll.
        fn get_chain_hash(self: @ContractState) -> u256 {
            self.chain_hash.read()
        }
    }
}
