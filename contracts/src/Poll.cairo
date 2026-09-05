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

/// Public inputs for one tally batch, plus a proof placeholder.
#[derive(Drop, Copy, Serde)]
pub struct TallyBatch {
    /// Chain hash after absorbing the real Ballots.
    pub new_chain_hash: u256,
    /// Live-ballot tree root after this batch.
    pub new_live_root: u256,
    /// Tally accumulator C1 points after this batch.
    pub new_accumulator_c1: Span<Span<u256>>,
    /// Tally accumulator C2 points after this batch.
    pub new_accumulator_c2: Span<Span<u256>>,
    /// Zero-knowledge proof used to verify the tally batch.
    pub proof: Span<u256>,
}

/// Public inputs for tally finalize, plus a proof placeholder.
#[derive(Drop, Copy, Serde)]
pub struct TallyFinalize {
    /// Tally accumulator C1 points.
    pub accumulator_c1: Span<Span<u256>>,
    /// Tally accumulator C2 points.
    pub accumulator_c2: Span<Span<u256>>,
    /// Public integer amount per vote option after Tally.
    pub tally_totals: Span<u256>,
    /// Zero-knowledge proof used to verify tally finalize.
    pub proof: Span<u256>,
}

/// Interface for interacting with a MACI poll.
///
/// Provides functionality for submitting ballots, running Tally, and
/// retrieving poll configuration and tally state.
#[starknet::interface]
pub trait IPoll<TContractState> {
    /// Submits a ballot to the poll.
    ///
    /// The ballot is validated and, if accepted, its hash is appended to the
    /// poll's chain hash and a [`Voted`] event is emitted.
    fn vote(ref self: TContractState, ballot: Ballot);

    /// Returns the current chain hash of the poll.
    fn get_chain_hash(self: @TContractState) -> u256;

    /// Applies one tally batch to the tally cursor.
    fn process_tally_batch(ref self: TContractState, batch: TallyBatch);

    /// Opens the tally accumulator to tally totals.
    fn tally_finalize(ref self: TContractState, tally: TallyFinalize);

    /// Returns the MACI-assigned poll id.
    fn poll_id(self: @TContractState) -> u256;

    /// Returns the start of the poll schedule.
    fn start_date(self: @TContractState) -> u64;

    /// Returns the end of the poll schedule.
    fn end_date(self: @TContractState) -> u64;

    /// Returns the poll public key.
    fn poll_public_key(self: @TContractState) -> (u256, u256);

    /// Returns the number of vote options.
    fn vote_options(self: @TContractState) -> u256;

    /// Returns the state-tree depth copied from create args.
    fn state_tree_depth(self: @TContractState) -> u8;

    /// Returns the tally batch size.
    fn batch_size(self: @TContractState) -> u32;

    /// Returns the number of accepted Ballots.
    fn ballot_count(self: @TContractState) -> u32;

    /// Returns the chain-hash checkpoint after tally batch `index`.
    fn chain_hash_checkpoint(self: @TContractState, index: u64) -> u256;

    /// Returns how many tally batches have been processed.
    fn tally_batches_processed(self: @TContractState) -> u64;

    /// Returns the live-ballot tree root stored for Tally.
    fn tally_live_root(self: @TContractState) -> u256;

    /// Returns the tally accumulator C1 points.
    fn tally_accumulator_c1(self: @TContractState) -> Span<Span<u256>>;

    /// Returns the tally accumulator C2 points.
    fn tally_accumulator_c2(self: @TContractState) -> Span<Span<u256>>;

    /// Returns the tally totals, empty until Tally is complete.
    fn tally_totals(self: @TContractState) -> Span<u256>;

    /// Returns whether Tally has completed.
    fn is_tally_complete(self: @TContractState) -> bool;
}

/// Errors returned by the poll contract.
pub mod Errors {
    /// Current time is before the poll start.
    pub const POLL_NOT_STARTED: felt252 = 'Poll not started';
    /// Current time is at or after the poll end.
    pub const POLL_ENDED: felt252 = 'Poll ended';
    /// Current time is before the poll end.
    pub const POLL_NOT_OVER: felt252 = 'Poll not over';
    /// Tally has already completed.
    pub const TALLY_COMPLETE: felt252 = 'Tally complete';
    /// `new_chain_hash` does not match the next chain-hash checkpoint.
    pub const INVALID_CHECKPOINT: felt252 = 'Invalid chain hash checkpoint';
    /// No remaining tally batch to process.
    pub const NO_TALLY_BATCH: felt252 = 'No tally batch';
    /// Not every tally batch has been processed.
    pub const TALLY_BATCHES_INCOMPLETE: felt252 = 'Tally batches incomplete';
}

/// MACI poll contract.
///
/// Manages ballot submissions, maintains a cryptographic chain hash of
/// submitted ballots, and records Tally progress after the poll schedule
/// ends.
#[starknet::contract]
pub mod Poll {
    use maci_common::crypto::poseidon_bn254::poseidon2;
    use starknet::get_block_timestamp;
    use starknet::storage::{
        MutableVecTrait, StoragePointerReadAccess, StoragePointerWriteAccess, Vec, VecTrait,
    };
    use crate::MACI::IMACIDispatcher;
    use crate::PollFactory::{PollConstructorArgs, assert_poll_config};
    use super::Errors;

    /// Persistent state for a MACI poll.
    #[storage]
    struct Storage {
        /// Address of the MACI contract associated with this poll.
        maci: IMACIDispatcher,
        /// Cryptographic chain hash of the ballots submitted to the poll.
        chain_hash: u256,
        /// MACI-assigned identifier of this poll.
        poll_id: u256,
        /// Start of the poll schedule.
        start_date: u64,
        /// End of the poll schedule.
        end_date: u64,
        /// Poll public key used to encrypt Votes.
        poll_public_key: (u256, u256),
        /// State-tree depth from create args.
        state_tree_depth: u8,
        /// Number of vote options.
        vote_options: u256,
        /// Maximum Ballots consumed by one tally batch.
        batch_size: u32,
        /// Number of accepted Ballots.
        ballot_count: u32,
        /// Chain hash after each completed tally batch (including a leftover last
        /// batch, sealed when Tally starts).
        chain_hash_checkpoints: Vec<u256>,
        /// Whether leftover ballots have been recorded as a final checkpoint.
        checkpoints_sealed: bool,
        /// Number of tally batches already processed.
        tally_batches_processed: u64,
        /// Live-ballot tree root for Tally.
        tally_live_root: u256,
        /// Tally accumulator C1 points.
        tally_accumulator_c1: Vec<(u256, u256)>,
        /// Tally accumulator C2 points.
        tally_accumulator_c2: Vec<(u256, u256)>,
        /// Tally totals after finalize.
        tally_totals: Vec<u256>,
        /// Whether Tally has completed.
        tally_complete: bool,
    }

    /// Events emitted by the poll contract.
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        Voted: Voted,
        TallyBatchProcessed: TallyBatchProcessed,
        TallyFinalized: TallyFinalized,
    }

    /// Event emitted when a ballot is submitted to the poll.
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

    /// Event emitted when a tally batch updates the tally cursor.
    #[derive(Drop, starknet::Event)]
    pub struct TallyBatchProcessed {
        /// Chain-hash prefix after this batch.
        pub chain_hash: u256,
        /// Live-ballot tree root after this batch.
        pub live_root: u256,
        /// Tally accumulator C1 points after this batch.
        pub accumulator_c1: Span<Span<u256>>,
        /// Tally accumulator C2 points after this batch.
        pub accumulator_c2: Span<Span<u256>>,
    }

    /// Event emitted when Tally completes.
    #[derive(Drop, starknet::Event)]
    pub struct TallyFinalized {
        /// Public integer amount per vote option.
        pub tally_totals: Span<u256>,
    }

    /// Initializes a new poll.
    #[constructor]
    fn constructor(ref self: ContractState, args: PollConstructorArgs) {
        assert_poll_config(args.start_date, args.end_date, args.vote_options, args.batch_size);

        self.maci.write(IMACIDispatcher { contract_address: args.maci });
        self.poll_id.write(args.poll_id);
        self.start_date.write(args.start_date);
        self.end_date.write(args.end_date);
        self.poll_public_key.write(args.poll_public_key);
        self.state_tree_depth.write(args.state_tree_depth);
        self.vote_options.write(args.vote_options);
        self.batch_size.write(args.batch_size);
        self.tally_live_root.write(args.empty_live_ballot_root);

        let vote_options: u32 = args.vote_options.try_into().unwrap();
        let mut index = 0_u32;

        while index < vote_options {
            self.tally_accumulator_c1.push((0, 1));
            self.tally_accumulator_c2.push((0, 1));
            index += 1;
        }
    }

    #[abi(embed_v0)]
    impl IPollImplementation of super::IPoll<ContractState> {
        /// Submits a ballot to the poll.
        ///
        /// The ballot hash is appended to the current chain hash using
        /// Poseidon:
        ///
        /// `new_chain_hash = Poseidon(current_chain_hash, ballot_hash)`
        fn vote(ref self: ContractState, ballot: super::Ballot) {
            let now = get_block_timestamp();
            assert(now >= self.start_date.read(), Errors::POLL_NOT_STARTED);
            assert(now < self.end_date.read(), Errors::POLL_ENDED);

            // verify ballot
            let new_chain_hash: u256 = poseidon2(self.chain_hash.read(), ballot.hash);
            self.chain_hash.write(new_chain_hash);

            let ballot_count = self.ballot_count.read() + 1;
            self.ballot_count.write(ballot_count);

            if ballot_count % self.batch_size.read() == 0 {
                self.chain_hash_checkpoints.push(new_chain_hash);
            }

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

        fn get_chain_hash(self: @ContractState) -> u256 {
            self.chain_hash.read()
        }

        /// Applies one tally batch to the tally cursor.
        ///
        /// Proof verification is a TODO. The contract binds `new_chain_hash` to
        /// the next chain-hash checkpoint so batches cannot skip or invent a
        /// prefix of the accepted Ballot sequence.
        fn process_tally_batch(ref self: ContractState, batch: super::TallyBatch) {
            self.assert_tally_callable();
            self.seal_chain_hash_checkpoints();

            let index = self.tally_batches_processed.read();
            assert(index < self.chain_hash_checkpoints.len(), Errors::NO_TALLY_BATCH);
            assert(
                batch.new_chain_hash == self.chain_hash_checkpoints.at(index).read(),
                Errors::INVALID_CHECKPOINT,
            );

            // verify tally batch
            self.tally_live_root.write(batch.new_live_root);
            self.write_accumulator_c1(batch.new_accumulator_c1);
            self.write_accumulator_c2(batch.new_accumulator_c2);
            self.tally_batches_processed.write(index + 1);

            self
                .emit(
                    Event::TallyBatchProcessed(
                        TallyBatchProcessed {
                            chain_hash: batch.new_chain_hash,
                            live_root: batch.new_live_root,
                            accumulator_c1: batch.new_accumulator_c1,
                            accumulator_c2: batch.new_accumulator_c2,
                        },
                    ),
                );
        }

        /// Opens the tally accumulator to tally totals.
        ///
        /// Proof verification is a TODO. Every chain-hash checkpoint must already
        /// have a processed tally batch.
        fn tally_finalize(ref self: ContractState, tally: super::TallyFinalize) {
            self.assert_tally_callable();
            self.seal_chain_hash_checkpoints();
            assert(
                self.tally_batches_processed.read() == self.chain_hash_checkpoints.len(),
                Errors::TALLY_BATCHES_INCOMPLETE,
            );

            // verify tally finalize
            let mut index = 0_u32;
            let len = tally.tally_totals.len();

            while index < len {
                self.tally_totals.push(*tally.tally_totals.at(index));
                index += 1;
            }

            self.tally_complete.write(true);

            self.emit(Event::TallyFinalized(TallyFinalized { tally_totals: tally.tally_totals }));
        }

        fn poll_id(self: @ContractState) -> u256 {
            self.poll_id.read()
        }

        fn start_date(self: @ContractState) -> u64 {
            self.start_date.read()
        }

        fn end_date(self: @ContractState) -> u64 {
            self.end_date.read()
        }

        fn poll_public_key(self: @ContractState) -> (u256, u256) {
            self.poll_public_key.read()
        }

        fn vote_options(self: @ContractState) -> u256 {
            self.vote_options.read()
        }

        fn state_tree_depth(self: @ContractState) -> u8 {
            self.state_tree_depth.read()
        }

        fn batch_size(self: @ContractState) -> u32 {
            self.batch_size.read()
        }

        fn ballot_count(self: @ContractState) -> u32 {
            self.ballot_count.read()
        }

        fn chain_hash_checkpoint(self: @ContractState, index: u64) -> u256 {
            self.chain_hash_checkpoints.at(index).read()
        }

        fn tally_batches_processed(self: @ContractState) -> u64 {
            self.tally_batches_processed.read()
        }

        fn tally_live_root(self: @ContractState) -> u256 {
            self.tally_live_root.read()
        }

        fn tally_accumulator_c1(self: @ContractState) -> Span<Span<u256>> {
            self.accumulator_c1_to_span()
        }

        fn tally_accumulator_c2(self: @ContractState) -> Span<Span<u256>> {
            self.accumulator_c2_to_span()
        }

        fn tally_totals(self: @ContractState) -> Span<u256> {
            let mut out = array![];
            let mut index = 0_u64;
            let len = self.tally_totals.len();

            while index < len {
                out.append(self.tally_totals.at(index).read());
                index += 1;
            }

            out.span()
        }

        fn is_tally_complete(self: @ContractState) -> bool {
            self.tally_complete.read()
        }
    }

    #[generate_trait]
    impl PollInternal of PollInternalTrait {
        fn assert_tally_callable(self: @ContractState) {
            assert(get_block_timestamp() >= self.end_date.read(), Errors::POLL_NOT_OVER);
            assert(!self.tally_complete.read(), Errors::TALLY_COMPLETE);
        }

        fn seal_chain_hash_checkpoints(ref self: ContractState) {
            if self.checkpoints_sealed.read() {
                return;
            }

            let ballot_count = self.ballot_count.read();
            let batch_size = self.batch_size.read();

            if ballot_count != 0 && (ballot_count % batch_size != 0) {
                self.chain_hash_checkpoints.push(self.chain_hash.read());
            }

            self.checkpoints_sealed.write(true);
        }

        fn write_accumulator_c1(ref self: ContractState, input: Span<Span<u256>>) {
            self.write_accumulator(input, true);
        }

        fn write_accumulator_c2(ref self: ContractState, input: Span<Span<u256>>) {
            self.write_accumulator(input, false);
        }

        fn write_accumulator(ref self: ContractState, input: Span<Span<u256>>, c1: bool) {
            let mut index = 0_u64;
            let len = if c1 {
                self.tally_accumulator_c1.len()
            } else {
                self.tally_accumulator_c2.len()
            };

            while index < len {
                let point = *input.at(index.try_into().unwrap());
                let value = (*point.at(0), *point.at(1));

                if c1 {
                    self.tally_accumulator_c1.at(index).write(value);
                } else {
                    self.tally_accumulator_c2.at(index).write(value);
                }

                index += 1;
            }
        }

        fn accumulator_c1_to_span(self: @ContractState) -> Span<Span<u256>> {
            self.accumulator_to_span(true)
        }

        fn accumulator_c2_to_span(self: @ContractState) -> Span<Span<u256>> {
            self.accumulator_to_span(false)
        }

        fn accumulator_to_span(self: @ContractState, c1: bool) -> Span<Span<u256>> {
            let mut out = array![];
            let mut index = 0_u64;

            let len = if c1 {
                self.tally_accumulator_c1.len()
            } else {
                self.tally_accumulator_c2.len()
            };

            while index < len {
                let (x, y) = if c1 {
                    self.tally_accumulator_c1.at(index).read()
                } else {
                    self.tally_accumulator_c2.at(index).read()
                };

                out.append(array![x, y].span());
                index += 1;
            }

            out.span()
        }
    }
}
