/// Interface for a Lean Incremental Merkle Tree (LeanIMT).
///
/// The tree stores non-zero field elements as leaves and incrementally
/// computes the Merkle root using the Poseidon hash function.
///
/// `TContractState` is the contract state type exposed by the implementing
/// Starknet contract.
#[starknet::interface]
pub trait ILeanIMT<TContractState> {
    /// Returns the current Merkle root.
    ///
    /// The root is stored at the current tree depth in `side_nodes`.
    ///
    /// Returns:
    /// - The current LeanIMT root as a `u256`.
    fn get_root(self: @TContractState) -> u256;

    /// Returns the number of leaves currently inserted into the tree.
    ///
    /// Returns:
    /// - The number of inserted leaves as a `u256`.
    fn get_size(self: @TContractState) -> u256;

    /// Returns the index assigned to a leaf.
    ///
    /// A return value of `0` indicates that the leaf has not been inserted.
    /// Inserted leaves are stored using a one-based index.
    ///
    /// Arguments:
    /// - `leaf`: The leaf value to look up.
    ///
    /// Returns:
    /// - The one-based insertion index of the leaf, or `0` if it is absent.
    fn get_leaf_index(self: @TContractState, leaf: u256) -> u256;

    /// Inserts a new leaf into the LeanIMT.
    ///
    /// The leaf must:
    /// - Be non-zero.
    /// - Be smaller than the SNARK scalar field modulus.
    /// - Not already exist in the tree.
    ///
    /// The tree is updated incrementally using Poseidon hashing.
    ///
    /// Arguments:
    /// - `leaf`: The field element to insert.
    ///
    /// Returns:
    /// - The new Merkle root after insertion.
    fn insert(ref self: TContractState, leaf: u256) -> u256;
}

/// Errors returned by the LeanIMT contract.
mod Errors {
    /// The leaf has already been inserted into the tree.
    pub const ALREADY_EXISTS: felt252 = 0;

    /// The leaf is invalid.
    ///
    /// A leaf is invalid when it is zero or greater than or equal to
    /// `SNARK_SCALAR_FIELD`.
    pub const INVALID_LEAF: felt252 = 1;
}

/// Scalar field modulus used to validate tree leaves.
///
/// This is the scalar field modulus of the BN254 curve and is used to ensure
/// that leaves are valid field elements for SNARK-related applications.
pub const SNARK_SCALAR_FIELD: u256 =
    21888242871839275222246405745257275088548364400416034343698204186575808495617;

#[starknet::contract]
pub mod LeanIMT {
    use core::hash::{HashStateExTrait, HashStateTrait};
    use core::num::traits::Pow;
    use core::poseidon::PoseidonTrait;
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use super::{Errors, SNARK_SCALAR_FIELD};

    /// Persistent storage for the Lean Incremental Merkle Tree.
    #[storage]
    struct Storage {
        /// Current depth of the tree.
        ///
        /// The depth grows when the number of inserted leaves exceeds the
        /// capacity of the current tree depth.
        depth: u32,
        /// Number of leaves currently inserted into the tree.
        ///
        /// This value is also used as the zero-based insertion index for
        /// the next leaf.
        size: u256,
        /// Stores the rightmost unpaired node at each tree level.
        ///
        /// These nodes are used as side nodes when calculating the next
        /// Merkle root during insertion.
        side_nodes: Map<u32, u256>,
        /// Maps each inserted leaf to its one-based insertion index.
        ///
        /// A value of `0` means that the leaf is not present in the tree.
        leaves: Map<u256, u256>,
    }

    /// Public implementation of the LeanIMT interface.
    ///
    /// The tree uses Poseidon as its hash function and maintains only the
    /// nodes necessary to incrementally calculate the current root.
    #[abi(embed_v0)]
    impl LeanIMTImplementation of super::ILeanIMT<ContractState> {
        /// Returns the current Merkle root.
        ///
        /// The root is stored in `side_nodes` at the current tree depth.
        fn get_root(self: @ContractState) -> u256 {
            let depth = self.depth.read();

            self.side_nodes.read(depth)
        }

        /// Returns the number of leaves inserted into the tree.
        fn get_size(self: @ContractState) -> u256 {
            self.size.read()
        }

        /// Returns the one-based insertion index of a leaf.
        ///
        /// Returns `0` when the leaf has not been inserted.
        fn get_leaf_index(self: @ContractState, leaf: u256) -> u256 {
            self.leaves.read(leaf)
        }

        /// Inserts a leaf into the LeanIMT and returns the resulting root.
        ///
        /// The insertion performs the following validation:
        /// 1. The leaf must be smaller than `SNARK_SCALAR_FIELD`.
        /// 2. The leaf must be non-zero.
        /// 3. The leaf must not already exist in the tree.
        ///
        /// The tree depth is increased when necessary. At each level,
        /// Poseidon is used to hash the current node with the stored side
        /// node whenever the insertion index indicates that a left/right
        /// subtree combination is required.
        ///
        /// The leaf is stored with a one-based index so that `0` can
        /// represent an absent leaf.
        fn insert(ref self: ContractState, leaf: u256) -> u256 {
            assert(leaf < SNARK_SCALAR_FIELD, Errors::INVALID_LEAF);
            assert(leaf != 0, Errors::INVALID_LEAF);
            assert(!self._has(leaf), Errors::ALREADY_EXISTS);

            let index = self.size.read();
            let mut depth = self.depth.read();

            if 2_u256.pow(depth) < index + 1 {
                depth += 1;
            }

            self.depth.write(depth);

            let mut node = leaf;

            for level in 0..depth {
                if (index / 2.pow(level)) % 2 == 1 {
                    let left = self.side_nodes.read(level);

                    node = PoseidonTrait::new().update_with((left, node)).finalize().into();
                } else {
                    self.side_nodes.write(level, node);
                }
            }

            self.size.write(index + 1);
            self.side_nodes.write(depth, node);
            self.leaves.write(leaf, index + 1);

            node
        }
    }

    /// Private helper functions for the LeanIMT contract.
    #[generate_trait]
    impl PrivateFunctions of PrivateFunctionsTrait {
        /// Checks whether a leaf has already been inserted.
        ///
        /// Since inserted leaves use one-based indices, a stored value of
        /// `0` indicates that the leaf is absent.
        fn _has(self: @ContractState, leaf: u256) -> bool {
            self.leaves.read(leaf) != 0
        }
    }
}
