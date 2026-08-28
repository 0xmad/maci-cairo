/// Vote-balance assigner that returns the same vote balance for every Subject.
///
/// The vote balance is set at construction and cannot be changed.
#[starknet::contract]
pub mod ConstantInitialVoteBalance {
    use core::num::traits::Pow;
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use crate::vote_balance::interfaces::IVoteBalanceAssigner::IVoteBalanceAssigner;

    /// Errors returned by the constant vote-balance assigner.
    pub mod Errors {
        /// The configured vote balance is zero.
        pub const ZERO_VOTE_BALANCE: felt252 = 'Zero vote balance';

        /// The configured vote balance does not fit the Ballot circuit.
        pub const VOTE_BALANCE_TOO_LARGE: felt252 = 'Vote balance too large';
    }

    /// Persistent storage for the constant assigner.
    #[storage]
    struct Storage {
        /// Vote balance returned for every Subject.
        vote_balance: u256,
    }

    /// Initializes the assigner with a constant vote balance.
    ///
    /// Arguments:
    /// - `vote_balance`: Vote balance returned by `get` for every Subject.
    ///   Must be greater than zero and less than `2^251`.
    #[constructor]
    fn constructor(ref self: ContractState, vote_balance: u256) {
        assert(vote_balance != 0, Errors::ZERO_VOTE_BALANCE);
        assert(vote_balance < 2_u256.pow(251), Errors::VOTE_BALANCE_TOO_LARGE);
        self.vote_balance.write(vote_balance);
    }

    /// Public implementation of the vote-balance assigner interface.
    #[abi(embed_v0)]
    impl ConstantInitialVoteBalanceImpl of IVoteBalanceAssigner<ContractState> {
        /// Returns the configured vote balance.
        ///
        /// The Subject and evidence are ignored.
        ///
        /// Arguments:
        /// - `subject`: Contract address of the Subject signing up.
        /// - `evidence`: Evidence supplied at Signup. It is ignored.
        ///
        /// Returns:
        /// - The vote balance set at construction.
        fn get(
            self: @ContractState, subject: starknet::ContractAddress, evidence: ByteArray,
        ) -> u256 {
            self.vote_balance.read()
        }
    }
}
