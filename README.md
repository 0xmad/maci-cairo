# MACI for Starknet

A Cairo implementation of **MACI (Minimal Anti-Collusion Infrastructure)** for Starknet.

This repository contains the on-chain contracts, shared cryptographic primitives, policy infrastructure, and Circom-based circuits needed to build privacy-preserving, collusion-resistant voting systems on Starknet.

## Overview

MACI is a privacy-preserving voting system designed to provide **collusion resistance**.

The core idea is that users can participate using cryptographic identities and encrypted votes, while the system is designed to prevent a coordinator from proving how an individual user voted.

This project brings the MACI architecture to the **Starknet / Cairo** ecosystem.

The repository currently includes:

- MACI state management
- User registration using BabyJubJub public keys
- Poseidon hashing
- Lean Incremental Merkle Trees (LeanIMT)
- State-tree root history
- Poll and poll-factory contracts
- Policy checkers and enforcers
- Ballot-related Circom circuits
- ElGamal-related circuits
- Vote-related circuits
- TypeScript circuit tooling and tests
- Starknet contract interfaces and events
- Modular arithmetic utilities

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

# Installation

Clone the repository, then install the toolchains below before building.

## Prerequisites

| Tool                                                                                                            | Version                     | Notes                                                        |
| --------------------------------------------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------ |
| [Scarb](https://docs.swmansion.com/scarb/download.html)                                                         | Cairo / Starknet **2.20.0** | Workspace `edition = "2024_07"`; pinned in `.tool-versions`  |
| [Starknet Foundry](https://foundry-rs.github.io/starknet-foundry/getting-started/installation.html) (`snforge`) | **0.63.0**                  | Cairo tests (`scarb test`); pinned in `.tool-versions`       |
| [Node.js](https://nodejs.org/)                                                                                  | **24** or **26**            | Root `package.json` `engines`                                |
| [pnpm](https://pnpm.io/installation)                                                                            | **11**                      | `corepack enable` is enough on a matching Node               |
| [Circom](https://docs.circom.io/getting-started/installation/)                                                  | **2.2.3**                   | Must be on `PATH`; matches `circuits/circomkit.json`         |
| [cairo-coverage](https://github.com/software-mansion/cairo-coverage)                                            | **0.6.1**                   | `asdf plugin add cairo-coverage`; pinned in `.tool-versions` |
| [lcov](https://github.com/linux-test-project/lcov)                                                              | any recent                  | `make test` HTML reports (`lcov` / `genhtml`)                |
| Docker                                                                                                          | optional                    | Garaga Groth16 verifier from a verification key              |

Install Scarb (Cairo 2.20 line):

```bash
curl --proto '=https' --tlsv1.2 -sSf https://docs.swmansion.com/scarb/install.sh | sh
```

Install Starknet Foundry 0.63.0:

```bash
curl -L https://raw.githubusercontent.com/foundry-rs/starknet-foundry/master/scripts/install.sh | sh
snfoundryup -v 0.63.0
```

Install Circom 2.2.3 (requires a Rust toolchain):

```bash
git clone https://github.com/iden3/circom.git
cd circom
git checkout v2.2.3
cargo install --path circom
```

Install `cairo-coverage` with [asdf](https://asdf-vm.com/) ([plugin](https://github.com/software-mansion/asdf-cairo-coverage)):

```bash
asdf plugin add cairo-coverage
asdf install cairo-coverage
```

The version comes from `.tool-versions`. `make test` also needs `lcov` (and `genhtml`) for HTML reports.

## JavaScript dependencies

From the repository root:

```bash
pnpm install
```

The root workspace installs `circuits` recursively.

## Build

```bash
make build
```

Equivalent package builds:

```bash
scarb build --package maci_common
scarb build --package maci_contracts
```

## Test

```bash
make test
```

This runs `maci_common` and `maci_contracts` tests with coverage, then circuit tests (`cd circuits && pnpm test`).

Format and lint (CI uses check-only):

```bash
make fmt          # scarb fmt --check + Prettier check
make fmt:fix      # write: scarb fmt + Prettier
make lint         # scarb lint + ESLint + TypeScript
make lint:fix     # scarb lint --fix + ESLint --fix
```

Cairo fuzz tests (feature `fuzz`; not part of `make test`):

```bash
make test-fuzz
```

Narrower commands (see also `AGENTS.md`):

```bash
scarb test --package maci_common
scarb test --package maci_contracts
cd circuits && pnpm test
```

Ballot circuit compile and Groth16 setup (needs Circom 2.2.3 and a powers-of-tau file under `circuits/ptau`):

```bash
cd circuits
pnpm compile:ballot
pnpm setup:ballot
```

CI (`.github/workflows/ci.yml`) runs on pull requests to `main`, pushes to `main`, and `workflow_dispatch`. It gates format, lint, Cairo build and coverage tests, and circuit Vitest (with Circom 2.2.3 on PATH). It does not run Cairo fuzz or Circom `compile:ballot` / `setup:ballot`.

Cairo fuzz (`.github/workflows/fuzz.yml`) runs weekly (Sunday 04:00 UTC) and on `workflow_dispatch`.

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

# Security

This project contains cryptographic and zero-knowledge components and should be treated as experimental until independently audited.

Before using the contracts in production, review at minimum:

- BabyJubJub implementation and validation
- Poseidon hashing
- LeanIMT correctness
- State-tree capacity calculations
- State-index conversions
- Duplicate signup handling
- Policy/enforcer behavior
- Cross-contract calls
- Poll state transitions
- Ballot validation
- ZK proof verification
- Circuit correctness
- Proving and verification-key generation
- Coordinator and off-chain message-processing logic

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
 ├── Vote-balance assigner
 │
 ├── Poseidon(public key, vote balance)
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
