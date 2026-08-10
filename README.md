# MACI Contracts — Cairo

A Cairo implementation of **MACI (Minimal Anti-Collusion Infrastructure)** smart contracts for Starknet.

This repository provides the core on-chain contracts and cryptographic primitives required to build a MACI-based voting and privacy-preserving coordination system on Starknet.

## Overview

MACI is a privacy-preserving voting system designed to provide **collusion resistance** by allowing users to submit encrypted votes while preventing a coordinator from proving how an individual user voted.

This Cairo implementation provides the foundational contracts and utilities used by MACI, including:

- MACI state management
- User registration
- BabyJubJub public-key validation
- Poseidon hashing
- Lean Incremental Merkle Trees (LeanIMT)
- Modular arithmetic utilities
- State-tree root history
- Starknet events and contract interfaces

The contracts are written in **Cairo** and target the **Starknet** ecosystem.

## Architecture

The project is organized into several modules:

```text
src/
├── crypto/
│   └── BabyJubJub
├── trees/
│   └── LeanIMT
├── utils/
│   └── math
└── MACI
```

### Crypto

The `crypto` module contains cryptographic primitives used by MACI.

Currently, this includes **BabyJubJub**, which is used for MACI user public keys.

Public keys are represented by their `(x, y)` coordinates and are validated against the BabyJubJub curve before registration.

### Trees

The `trees` module contains authenticated tree structures used by MACI.

The current implementation uses a **Lean Incremental Merkle Tree (LeanIMT)**. The tree uses Poseidon hashing and maintains its root incrementally as new leaves are inserted.

The MACI state tree stores hashes of registered public keys.

### Utils

The `utils` module contains reusable mathematical utilities.

The `math` module provides modular arithmetic operations over `u256` values:

- `add_mod`
- `sub_mod`
- `mul_mod`
- `pow_mod`

These functions are useful for cryptographic operations where arithmetic must be performed modulo a field modulus.

### MACI

The `MACI` module contains the main MACI contract.

It manages:

- State-tree configuration
- User signups
- Public-key validation
- Public-key hashing
- State indices
- State-tree roots
- Signup events

## MACI Contract

The main contract is:

```cairo
#[starknet::contract]
pub mod MACI
```

The contract uses an external LeanIMT contract as its state tree.

### State Tree

Each registered user contributes a leaf to the state tree.

The leaf is derived from the user's BabyJubJub public key:

```text
public key
    │
    ├── x
    └── y
        │
        ▼
     Poseidon
        │
        ▼
  public key hash
        │
        ▼
    LeanIMT
        │
        ▼
   state root
```

A padding leaf is inserted when the MACI contract is initialized.

The initial padding value is:

```cairo
Constants::PAD_KEY_HASH
```

This allows the state tree to maintain a defined initial state before users sign up.

## User Signup

Users register with the MACI contract through:

```cairo
fn sign_up(
    ref self: TContractState,
    public_key: PublicKey,
    sign_up_data: ByteArray
)
```

The signup process performs the following steps:

1. Check that the state tree has available capacity.
2. Validate that the public key lies on the BabyJubJub curve.
3. Hash the public key using Poseidon.
4. Insert the hash into the LeanIMT state tree.
5. Record the resulting state-tree root.
6. Emit a `Signup` event.

The public key is represented as:

```cairo
#[derive(Drop, Copy, Serde)]
pub struct PublicKey {
    pub x: u256,
    pub y: u256,
}
```

### Signup Events

Successful signups emit:

```cairo
Signup {
    state_index,
    public_key_x,
    public_key_y,
    timestamp,
}
```

This allows off-chain applications and coordinators to track state-tree updates.

## State Tree Roots

The MACI contract maintains a history of state-tree roots.

The current root can be queried with:

```cairo
fn get_state_tree_root(self: @TContractState) -> u256;
```

Historical roots can be accessed by signup index:

```cairo
fn get_state_tree_root_indexed_signup(
    self: @TContractState,
    index: u64
) -> u256;
```

The initial root is recorded during construction, before any user signup.

This historical root tracking is useful for associating MACI operations with a specific state of the user registry.

## State Indices

A registered public-key hash can be resolved to its state index:

```cairo
fn get_state_index(
    self: @TContractState,
    public_key_hash: u256
) -> u256;
```

The underlying LeanIMT stores leaf indices as one-based values. The MACI interface exposes them as zero-based state indices.

## State Tree Capacity

The state tree is binary:

```cairo
pub const STATE_TREE_ARITY: u8 = 2;
```

The maximum number of leaves is calculated from the configured tree depth:

```text
max_signups = 2 ^ state_tree_depth
```

The initial padding leaf occupies one position in the tree, so the public signup count excludes this padding entry.

## Poseidon Hashing

Public keys are hashed using the Starknet Poseidon implementation:

```cairo
pub fn hash_public_key(public_key: PublicKey) -> u256 {
    PoseidonTrait::new()
        .update_with((public_key.x, public_key.y))
        .finalize()
        .into()
}
```

The hash is calculated over the ordered pair:

```text
(x, y)
```

The resulting value becomes the state-tree leaf.

## LeanIMT

The state tree is implemented using a separate LeanIMT contract.

The interface exposes:

```cairo
fn get_root(self: @TContractState) -> u256;

fn get_size(self: @TContractState) -> u256;

fn get_leaf_index(
    self: @TContractState,
    leaf: u256
) -> u256;

fn insert(
    ref self: TContractState,
    leaf: u256
) -> u256;
```

The tree uses Poseidon hashing and incrementally maintains its Merkle root.

Leaves must:

- Be non-zero.
- Be smaller than the configured SNARK scalar field.
- Not already exist in the tree.

## Errors

The MACI contract currently defines:

| Error                | Description                                             |
| -------------------- | ------------------------------------------------------- |
| `TOO_MANY_SIGNUPS`   | The state tree has reached its configured capacity.     |
| `INVALID_PUBLIC_KEY` | The supplied public key is not on the BabyJubJub curve. |

The LeanIMT contract additionally handles invalid and duplicate leaves.

## Constructor

The MACI contract is initialized using:

```cairo
pub struct ConstructorParams {
    pub state_tree_depth: u8,
    pub state_tree_address: ContractAddress,
    pub empty_ballot_roots: (u256, u256, u256, u256, u256),
}
```

The constructor:

1. Calculates the maximum state-tree capacity.
2. Creates the LeanIMT dispatcher.
3. Inserts the padding key hash.
4. Stores the initial state-tree root.
5. Stores the state-tree configuration.
6. Stores the empty ballot roots.

## Development

This project is written in Cairo and is intended to be compiled and tested using the Starknet/Cairo development toolchain.

A typical development workflow is:

```bash
scarb build
```

Run the test suite with:

```bash
scarb test
```

> The exact commands and required tool versions depend on the project's `Scarb.toml` configuration.

## Security Considerations

MACI relies on several cryptographic assumptions and components.

Before deploying to production, the implementation should be independently reviewed and audited.

Particular attention should be given to:

- BabyJubJub curve validation
- Poseidon hashing
- State-tree correctness
- State index handling
- Duplicate signup prevention
- Tree capacity calculations
- State-root history
- Field-element validation
- Cross-contract calls to the LeanIMT implementation
- Coordinator and voting flows built on top of these contracts

This repository provides the on-chain primitives and state-management layer; a complete MACI deployment also requires the corresponding off-chain coordinator, message-processing, proving, and verification infrastructure.
