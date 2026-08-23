# MACI for Starknet

A Cairo implementation of **MACI (Minimal Anti-Collusion Infrastructure)** for Starknet.

This repository contains the on-chain contracts, shared cryptographic primitives, policy infrastructure, and Circom-based circuits needed to build privacy-preserving, collusion-resistant voting systems on Starknet.

## Overview

MACI is a privacy-preserving voting system designed to provide **collusion resistance**.

The core idea is that users can participate using cryptographic identities and encrypted votes, while the system is designed to prevent a coordinator from proving how an individual user voted.

This project brings the MACI architecture to the **Starknet / Cairo** ecosystem.

The repository currently includes:

* MACI state management
* User registration using BabyJubJub public keys
* Poseidon hashing
* Lean Incremental Merkle Trees (LeanIMT)
* State-tree root history
* Poll and poll-factory contracts
* Policy checkers and enforcers
* Ballot-related Circom circuits
* ElGamal-related circuits
* Vote-related circuits
* TypeScript circuit tooling and tests
* Starknet contract interfaces and events
* Modular arithmetic utilities

---

## Repository Structure

The repository is a Scarb workspace containing three packages:

```text
.
├── common/
│   └── Shared Cairo primitives and cryptographic utilities
│
├── contracts/
│   └── Starknet contracts
│       └── src/
│           ├── MACI.cairo
│           ├── Poll.cairo
│           ├── PollFactory.cairo
│           ├── policies.cairo
│           ├── trees.cairo
│           ├── utils.cairo
│           ├── policies/
│           │   ├── checkers/
│           │   └── enforcers/
│           ├── trees/
│           ├── utils/
│           └── experiments/
│
├── circuits/
│   ├── circom/
│   │   ├── ballot/
│   │   ├── elgamal/
│   │   ├── utils/
│   │   └── vote/
│   ├── ptau/
│   ├── test/
│   ├── ts/
│   ├── Dockerfile
│   └── package.json
│
├── Makefile
├── Scarb.toml
├── Scarb.lock
├── package.json
├── pnpm-lock.yaml
└── pnpm-workspace.yaml
```

The workspace configuration currently includes `common`, `contracts`, and `circuits`.

---

## Architecture

At a high level, the system is composed of three layers:

```text
                    ┌─────────────────────┐
                    │      Circuits       │
                    │  Circom / ZK proofs │
                    └──────────┬──────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────┐
│                 Starknet Contracts                 │
│                                                    │
│   MACI ────── PollFactory ────── Poll              │
│    │              │                │               │
│    │              │                └─ Ballots      │
│    │              │                                │
│    ├── Policies / Enforcers                        │
│    │                                               │
│    └── LeanIMT State Tree                          │
└───────────────────────┬────────────────────────────┘
                        │
                        ▼
              ┌──────────────────┐
              │ Common Primitives│
              │ BabyJubJub, etc. │
              └──────────────────┘
```

The Cairo contracts are responsible for the on-chain state and interfaces, while the circuit package contains the zero-knowledge proving components used by the broader MACI protocol.

---

# Contracts

## MACI

The main contract is:

```cairo
#[starknet::contract]
pub mod MACI
```

The MACI contract manages:

* State-tree configuration
* User signups
* BabyJubJub public-key validation
* Public-key hashing
* State indices
* State-tree roots
* Historical state roots
* Signup events
* Policy enforcement
* Poll identifiers
* Empty ballot roots

The current constructor accepts:

```cairo
pub struct ConstructorParams {
    pub state_tree_depth: u8,
    pub state_tree_address: ContractAddress,
    pub empty_ballot_roots: (u256, u256, u256, u256, u256),
    pub enforcer: ContractAddress,
}
```

The MACI contract uses an external LeanIMT contract as its state tree and an external enforcer contract for signup policy enforcement.

### User Registration

Users register through:

```cairo
fn sign_up(
    ref self: TContractState,
    public_key: PublicKey,
    sign_up_data: ByteArray
)
```

A public key is represented as:

```cairo
#[derive(Drop, Copy, Serde)]
pub struct PublicKey {
    pub x: u256,
    pub y: u256,
}
```

The signup flow is:

1. Check state-tree capacity.
2. Validate the BabyJubJub public key.
3. Pass the caller and signup data to the configured enforcer.
4. Hash the public key using Poseidon.
5. Insert the resulting hash into the LeanIMT state tree.
6. Record the resulting state-tree root.
7. Emit a `Signup` event.

### State Tree

The state tree is binary:

```cairo
pub const STATE_TREE_ARITY: u8 = 2;
```

Its maximum capacity is calculated as:

```text
max_signups = 2 ^ state_tree_depth
```

A reserved padding leaf is inserted when the MACI contract is initialized.

The public signup count excludes this padding leaf.

### State Root History

The contract keeps historical state-tree roots.

The current root can be queried with:

```cairo
fn get_state_tree_root(self: @TContractState) -> u256;
```

A historical root can be queried with:

```cairo
fn get_state_tree_root_indexed_signup(
    self: @TContractState,
    index: u64
) -> u256;
```

Index `0` represents the initial padded state before any user signup.

### State Indices

A public-key hash can be resolved to its zero-based state index:

```cairo
fn get_state_index(
    self: @TContractState,
    public_key_hash: u256
) -> u256;
```

The underlying LeanIMT uses one-based leaf indices; the MACI interface converts these to zero-based state indices.

---

# Polls

The repository contains a dedicated `Poll` contract for ballot submission.

A ballot currently contains:

```cairo
pub struct Ballot {
    pub hash: u256,
    pub user_commitment: u256,
    pub encrypted_votes_c1: Span<Span<u256>>,
    pub encrypted_votes_c2: Span<Span<u256>>,
    pub proof: Span<u256>,
}
```

The poll maintains a cryptographic chain hash.

When a ballot is submitted, the current implementation computes:

```text
new_chain_hash =
    Poseidon(current_chain_hash, ballot_hash)
```

and emits a `Voted` event containing the ballot information and resulting chain hash.

# PollFactory

`PollFactory` deploys new poll contracts from a configured class hash.

The factory accepts:

```cairo
pub struct CreatePollArgs {
    pub start_date: u64,
    pub end_date: u64,
    pub poll_public_key: (u256, u256),
    pub maci: ContractAddress,
    pub state_tree_depth: u8,
    pub vote_options: u256,
}
```

A poll is deployed with the configured poll class hash and a `PollCreated` event is emitted containing the newly deployed contract address.

---

# Policies

MACI signup can be restricted through an external **enforcer** contract.

The policy system is organized into:

```text
contracts/src/policies/
├── checkers/
└── enforcers/
```

The current repository includes a `FreeForAll` checker/enforcer implementation.

The MACI constructor receives an enforcer address:

```cairo
pub enforcer: ContractAddress
```

During signup, the configured enforcer receives the caller address and supplied `sign_up_data` before the public key is inserted into the state tree.

This architecture allows signup eligibility rules to be implemented separately from the core MACI state-management contract.

---

# Cryptography

## BabyJubJub

MACI users are represented by BabyJubJub public keys.

Keys are supplied as `(x, y)` coordinates and validated before registration.

The common package contains the BabyJubJub implementation used by the contracts.

## Poseidon

Public keys are hashed using the Starknet Poseidon implementation:

```cairo
pub fn hash_public_key(public_key: PublicKey) -> u256 {
    PoseidonTrait::new()
        .update_with((public_key.x, public_key.y))
        .finalize()
        .into()
}
```

The hash is computed over the ordered pair:

```text
(x, y)
```

The resulting value is inserted into the MACI state tree.

## LeanIMT

The MACI state tree is backed by a separate Lean Incremental Merkle Tree contract.

The contract interface includes:

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

State-tree leaves must be non-zero, fit within the configured field constraints, and not already exist in the tree.

---

# Circuits

The `circuits` package contains the zero-knowledge circuit implementation and associated TypeScript tooling.

The current circuit tree contains:

```text
circuits/
├── circom/
│   ├── ballot/
│   ├── elgamal/
│   ├── utils/
│   └── vote/
├── ptau/
├── test/
└── ts/
```

The package uses:

* CircomKit
* Circom
* `circomlib`
* `snarkjs`
* `@zk-kit/binary-merkle-root.circom`
* LeanIMT utilities
* Poseidon utilities
* Vitest
* fast-check

### Circuit Commands

From the `circuits` directory:

```bash
pnpm install
```

Run circuit tests:

```bash
pnpm test
```

Compile the ballot circuit:

```bash
pnpm compile:ballot
```

Generate the ballot proving setup:

```bash
pnpm setup:ballot
```

Build the TypeScript circuit package:

```bash
pnpm build
```

The repository also contains a Docker-based Garaga workflow for generating a verifier from a Groth16 verification key.

---

# Development

## Prerequisites

The repository uses:

* **Cairo / Scarb** for Starknet contracts
* **Starknet Foundry (`snforge`)** for Cairo tests
* **Node.js**
* **pnpm**
* **Circom / CircomKit**
* Docker for the Garaga verifier workflow

The contract packages currently target Starknet `2.20.0` and use Starknet Foundry `0.63.0`.

The root JavaScript workspace declares Node `24` or `26` and pnpm `11`.

## Install JavaScript Dependencies

At the repository root:

```bash
pnpm install
```

The root workspace is configured to run package scripts recursively.

## Build Cairo Packages

Build the shared package:

```bash
scarb build --package maci_common
```

Build the contracts:

```bash
scarb build --package maci_contracts
```

Or use the Makefile:

```bash
make build
```

The current Makefile defines separate build targets for the common and contract packages.

## Run Tests

Run the complete test workflow:

```bash
make test
```

This runs:

* Cairo contract tests
* Common-package tests
* Circuit tests

You can also run individual Cairo tests:

```bash
cd common
scarb test
```

```bash
cd contracts
scarb test
```

Circuit tests:

```bash
cd circuits
pnpm test
```

---

# Coverage

The Cairo test workflow supports coverage generation through Starknet Foundry.

Run:

```bash
make test
```

The Makefile generates coverage reports for both `common` and `contracts` and uses `lcov` / `genhtml` to produce HTML reports.

Generated coverage directories can be removed with:

```bash
make clean
```

---

# Useful Contract Interfaces

## MACI

```cairo
fn state_tree_depth(self: @TContractState) -> u8;

fn get_state_tree_root(self: @TContractState) -> u256;

fn get_state_index(
    self: @TContractState,
    public_key_hash: u256
) -> u256;

fn sign_up(
    ref self: TContractState,
    public_key: PublicKey,
    sign_up_data: ByteArray
);

fn get_state_tree_root_indexed_signup(
    self: @TContractState,
    index: u64
) -> u256;

fn total_signups(self: @TContractState) -> u256;
```

## Poll

```cairo
fn vote(
    ref self: TContractState,
    ballot: Ballot
);

fn get_chain_hash(
    self: @TContractState
) -> u256;
```

## PollFactory

```cairo
fn create_poll(
    ref self: TContractState,
    args: CreatePollArgs
) -> ContractAddress;

fn get_poll_class_hash(
    self: @TContractState
) -> ClassHash;
```

---

# Events

## MACI

Successful signups emit:

```cairo
Signup {
    state_index,
    public_key_x,
    public_key_y,
    timestamp,
}
```

The event allows off-chain applications to track user registration and state-tree updates.

## Poll

Successful ballot submissions emit:

```cairo
Voted {
    hash,
    user_commitment,
    encrypted_votes_c1,
    encrypted_votes_c2,
    chain_hash,
}
```

The chain hash provides an ordered cryptographic commitment to submitted ballots.

## PollFactory

New polls emit:

```cairo
PollCreated {
    contract_address,
}
```

---

# Error Handling

The MACI contract currently defines:

| Error                | Description                                              |
| -------------------- | -------------------------------------------------------- |
| `TOO_MANY_SIGNUPS`   | The state tree has reached its configured capacity.      |
| `INVALID_PUBLIC_KEY` | The supplied public key is not a valid BabyJubJub point. |

The LeanIMT implementation additionally handles invalid and duplicate leaves.

---

# Security

This project contains cryptographic and zero-knowledge components and should be treated as experimental until independently audited.

Before using the contracts in production, review at minimum:

* BabyJubJub implementation and validation
* Poseidon hashing
* LeanIMT correctness
* State-tree capacity calculations
* State-index conversions
* Duplicate signup handling
* Policy/enforcer behavior
* Cross-contract calls
* Poll state transitions
* Ballot validation
* ZK proof verification
* Circuit correctness
* Proving and verification-key generation
* Coordinator and off-chain message-processing logic

In particular, the current `Poll` implementation should **not** be interpreted as a complete production ballot-verification layer: although `Ballot` contains a proof field, `vote` currently updates the chain hash and emits the ballot data without performing proof verification itself.

---

# Current Scope

This repository currently provides the building blocks for a Starknet-based MACI implementation:

```text
User
 │
 │ BabyJubJub public key
 ▼
MACI
 │
 ├── Policy enforcement
 │
 ├── Poseidon(public key)
 │
 ▼
LeanIMT State Tree
 │
 └── State root history
 │
 ▼
Poll / PollFactory
 │
 └── Encrypted ballots
       │
       ▼
   ZK Circuits
```

A complete MACI deployment still requires additional off-chain infrastructure, including coordinator logic, message processing, proof generation, proof verification integration, and application-level orchestration.
