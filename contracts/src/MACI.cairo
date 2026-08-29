use starknet::ContractAddress;

/// A BabyJubJub public key represented by its affine coordinates.
///
/// The coordinates must represent a valid point on the BabyJubJub curve
/// before the key can be registered through `sign_up`.
#[derive(Drop, Copy, Serde)]
pub struct PublicKey {
    /// The x-coordinate of the public key.
    pub x: u256,
    /// The y-coordinate of the public key.
    pub y: u256,
}

/// Configuration parameters used to initialize the MACI contract.
#[derive(Drop, Serde)]
pub struct ConstructorParams {
    /// Depth of the state tree.
    ///
    /// The maximum number of state-tree leaves is `2^state_tree_depth`.
    pub state_tree_depth: u8,
    /// Address of the LeanIMT contract used as the MACI state tree.
    pub state_tree_address: ContractAddress,
    /// Precomputed empty ballot tree roots for supported depths.
    pub empty_ballot_roots: (u256, u256, u256, u256, u256),
    /// Address of the enforcer contract used to enforce policy restrict
    pub enforcer: ContractAddress,
    /// Address of the vote-balance assigner used at Signup.
    pub vote_balance_assigner: ContractAddress,
}

/// Interface for the MACI contract.
///
/// Provides access to the state tree and allows users to register a
/// Signup leaf (user public key and vote balance) together with
/// arbitrary signup data.
#[starknet::interface]
pub trait IMACI<TContractState> {
    /// Returns the configured state tree depth.
    fn state_tree_depth(self: @TContractState) -> u8;

    /// Returns the current root of the MACI state tree.
    fn get_state_tree_root(self: @TContractState) -> u256;

    /// Returns the zero-based state index associated with a state-tree leaf.
    ///
    /// The underlying LeanIMT stores leaf indices as one-based values, so
    /// this function subtracts one before returning the index.
    ///
    /// Arguments:
    /// - `leaf`: Poseidon hash of a registered user public key and vote
    ///   balance, or the padding leaf.
    ///
    /// Returns:
    /// - The zero-based state index of the corresponding leaf.
    fn get_state_index(self: @TContractState, leaf: u256) -> u256;

    /// Registers a Signup in the MACI state tree.
    ///
    /// The public key must represent a valid BabyJubJub curve point and the
    /// state tree must have available capacity. Vote balance is obtained from
    /// the vote-balance assigner and bound into the state-tree leaf at Signup.
    ///
    /// The supplied signup data is accepted as part of the signup interface.
    fn sign_up(ref self: TContractState, public_key: PublicKey, sign_up_data: ByteArray);

    /// Returns the state tree root recorded after a signup at `index`.
    ///
    /// The first stored root corresponds to the initial padded state-tree
    /// state established during construction.
    fn get_state_tree_root_indexed_signup(self: @TContractState, index: u64) -> u256;

    /// Returns the number of user signups.
    ///
    /// The initial padding leaf is excluded from this count.
    fn total_signups(self: @TContractState) -> u256;
}

/// Constants used by the MACI state tree.
pub mod Constants {
    /// Arity of the binary state tree.
    pub const STATE_TREE_ARITY: u8 = 2;

    /// Reserved padding key hash inserted into the state tree during
    /// contract initialization.
    pub const PAD_KEY_HASH: u256 =
        1309255631273308531193241901289907343161346846555918942743921933037802809814;
}

/// Errors returned by the MACI contract.
pub mod Errors {
    /// The state tree has reached its maximum signup capacity.
    pub const TOO_MANY_SIGNUPS: felt252 = 'Too many signups';

    /// The supplied public key is not a valid BabyJubJub curve point.
    pub const INVALID_PUBLIC_KEY: felt252 = 'Invalid public key';

    /// The vote-balance assigner returned zero.
    pub const ZERO_VOTE_BALANCE: felt252 = 'Zero vote balance';

    /// The vote-balance assigner returned a value that does not fit the Ballot circuit.
    pub const VOTE_BALANCE_TOO_LARGE: felt252 = 'Vote balance too large';
}

#[starknet::contract]
pub mod MACI {
    use core::num::traits::Pow;
    use maci_common::crypto::BabyJubJub::BabyJubJub;
    use maci_common::crypto::poseidon_bn254::poseidon3;
    use starknet::event::EventEmitter;
    use starknet::storage::{
        MutableVecTrait, StoragePointerReadAccess, StoragePointerWriteAccess, Vec, VecTrait,
    };
    use crate::policies::interfaces::IEnforcer::{IEnforcerDispatcher, IEnforcerDispatcherTrait};
    use crate::trees::LeanIMT::{ILeanIMTDispatcher, ILeanIMTDispatcherTrait};
    use crate::vote_balance::interfaces::IVoteBalanceAssigner::{
        IVoteBalanceAssignerDispatcher, IVoteBalanceAssignerDispatcherTrait,
    };
    use super::{Constants, ConstructorParams, Errors, PublicKey};

    /// Persistent storage for the MACI contract.
    #[storage]
    struct Storage {
        /// Dispatcher for the external enforcer contract used to enforce policy restrictions.
        enforcer: IEnforcerDispatcher,
        /// Dispatcher for the vote-balance assigner used at Signup.
        vote_balance_assigner: IVoteBalanceAssignerDispatcher,
        /// Configured depth of the state tree.
        state_tree_depth: u8,
        /// Maximum number of leaves that can be stored in the state tree.
        ///
        /// This is calculated as `STATE_TREE_ARITY^state_tree_depth`.
        max_signups: u256,
        /// Precomputed empty ballot roots.
        empty_ballot_roots: (u256, u256, u256, u256, u256),
        /// Identifier for the next poll.
        next_poll_id: u256,
        /// Dispatcher for the external LeanIMT state tree.
        state_tree: ILeanIMTDispatcher,
        /// Historical state tree roots recorded after each signup.
        ///
        /// The initial padding root is stored at index `0`.
        state_roots_on_signup: Vec<u256>,
    }

    /// Events emitted by the MACI contract.
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        /// Emitted when a new user signs up to MACI.
        Signup: Signup,
    }

    /// Signup event containing the registered public key and state index.
    #[derive(Drop, starknet::Event)]
    pub struct Signup {
        /// Zero-based state index assigned to the signup.
        #[key]
        pub state_index: u256,
        /// X-coordinate of the registered BabyJubJub public key.
        #[key]
        pub public_key_x: u256,
        /// Y-coordinate of the registered BabyJubJub public key.
        #[key]
        pub public_key_y: u256,
        /// Vote balance bound into this Signup leaf.
        pub vote_balance: u256,
        /// Block timestamp at which the signup was registered.
        pub timestamp: u64,
    }

    /// Initializes the MACI contract.
    ///
    /// The constructor:
    /// - Calculates the maximum state-tree capacity.
    /// - Creates a dispatcher for the supplied LeanIMT state tree.
    /// - Inserts the padding key hash as the initial state leaf.
    /// - Stores the initial state-tree root.
    /// - Persists the tree configuration and empty ballot roots.
    /// - Creates a dispatcher for the supplied enforcer.
    /// - Creates a dispatcher for the supplied vote-balance assigner.
    #[constructor]
    fn constructor(ref self: ContractState, params: ConstructorParams) {
        let arity: u256 = Constants::STATE_TREE_ARITY.into();
        let max_signups: u256 = arity.pow(params.state_tree_depth.into());
        let state_tree = ILeanIMTDispatcher { contract_address: params.state_tree_address };
        let enforcer = IEnforcerDispatcher { contract_address: params.enforcer };
        let vote_balance_assigner = IVoteBalanceAssignerDispatcher {
            contract_address: params.vote_balance_assigner,
        };

        state_tree.insert(Constants::PAD_KEY_HASH);

        self.enforcer.write(enforcer);
        self.vote_balance_assigner.write(vote_balance_assigner);
        self.state_roots_on_signup.push(Constants::PAD_KEY_HASH);
        self.state_tree_depth.write(params.state_tree_depth);
        self.max_signups.write(max_signups);
        self.empty_ballot_roots.write(params.empty_ballot_roots);
        self.state_tree.write(state_tree);
    }

    /// Public implementation of the MACI interface.
    #[abi(embed_v0)]
    impl MACIImplementation of super::IMACI<ContractState> {
        /// Returns the configured state tree depth.
        fn state_tree_depth(self: @ContractState) -> u8 {
            self.state_tree_depth.read()
        }

        /// Returns the current MACI state tree root.
        fn get_state_tree_root(self: @ContractState) -> u256 {
            self.state_tree.read().get_root()
        }

        /// Returns the zero-based state index for a state-tree leaf.
        ///
        /// The underlying LeanIMT uses one-based leaf indices, so the stored
        /// index is decremented before being returned.
        fn get_state_index(self: @ContractState, leaf: u256) -> u256 {
            self.state_tree.read().get_leaf_index(leaf) - 1
        }

        /// Registers a new user in the MACI state tree.
        ///
        /// The signup fails if the state tree has reached its maximum
        /// capacity, if the supplied public key is not on the BabyJubJub
        /// curve, or if the configured enforcer rejects the caller.
        ///
        /// The configured enforcer is called with the caller's address and
        /// the supplied signup data, then the vote-balance assigner returns the
        /// vote balance bound into the leaf. The leaf is Poseidon(user public
        /// key, vote balance). The resulting root is recorded and a `Signup`
        /// event is emitted.
        ///
        /// Arguments:
        /// - `public_key`: BabyJubJub public key to register.
        /// - `sign_up_data`: Data supplied to the configured enforcer for policy
        ///   validation.
        fn sign_up(ref self: ContractState, public_key: PublicKey, sign_up_data: ByteArray) {
            let state_tree = self.state_tree.read();
            let size = state_tree.get_size();
            let max_signups = self.max_signups.read();

            assert(size < max_signups, Errors::TOO_MANY_SIGNUPS);
            assert(BabyJubJub::is_on_curve(public_key.x, public_key.y), Errors::INVALID_PUBLIC_KEY);

            self.enforcer.read().enforce(starknet::get_caller_address(), sign_up_data.clone());

            let vote_balance = self
                .vote_balance_assigner
                .read()
                .get(starknet::get_caller_address(), sign_up_data);

            assert(vote_balance != 0, Errors::ZERO_VOTE_BALANCE);
            assert(vote_balance < 2_u256.pow(251), Errors::VOTE_BALANCE_TOO_LARGE);

            let root = state_tree.insert(hash_state_leaf(public_key, vote_balance));
            self.state_roots_on_signup.push(root);

            self
                .emit(
                    Event::Signup(
                        Signup {
                            state_index: size,
                            timestamp: starknet::get_block_timestamp(),
                            public_key_x: public_key.x,
                            public_key_y: public_key.y,
                            vote_balance,
                        },
                    ),
                )
        }

        /// Returns the state tree root recorded after a specific signup.
        ///
        /// Root index `0` represents the initial state established by the
        /// constructor before any user signup.
        fn get_state_tree_root_indexed_signup(self: @ContractState, index: u64) -> u256 {
            self.state_roots_on_signup.at(index).read()
        }

        /// Returns the total number of user signups.
        ///
        /// The initial padding leaf is excluded from the count.
        fn total_signups(self: @ContractState) -> u256 {
            self.state_tree.read().get_size() - 1
        }
    }

    /// Computes the Poseidon hash of a state-tree leaf.
    ///
    /// The leaf preimage is the ordered triple `(public_key.x, public_key.y,
    /// vote_balance)`, the same binding the Ballot circuit hashes.
    ///
    /// Arguments:
    /// - `public_key`: BabyJubJub public key bound in the Signup.
    /// - `vote_balance`: Vote-amount budget bound in the Signup.
    ///
    /// Returns:
    /// - Poseidon hash of the state-tree leaf.
    pub fn hash_state_leaf(public_key: PublicKey, vote_balance: u256) -> u256 {
        poseidon3(public_key.x, public_key.y, vote_balance)
    }
}
