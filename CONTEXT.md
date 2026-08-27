# Project context

## Purpose

This repository implements Minimal Anti-Collusion Infrastructure (MACI) for
Starknet. Cairo contracts manage protocol state and policy enforcement;
Circom circuits provide zero-knowledge ballot, vote, and ElGamal proving
components; shared Cairo code contains cryptographic and mathematical
primitives.

## Boundaries

```text
circuits (Circom + TypeScript proving/test tooling)
    -> public proof and field representations
contracts (Starknet entrypoints, storage, events, policies, trees)
    -> shared Cairo primitives
common (cryptography, math, reusable Cairo utilities)
```

`common` is a dependency of the contract layer. `circuits` is a separate
pnpm package and must not be coupled to contract infrastructure merely for
test convenience.

## Domain vocabulary

- **MACI**: the top-level protocol contract coordinating signup and polls.
- **Poll**: a voting instance with its own identifiers, keys, and ballot
  processing state.
- **State tree**: the Lean Incremental Merkle Tree containing registered user
  state.
- **State root history**: roots retained so proofs can reference a historical
  signup state.
- **Policy**: the checker/enforcer mechanism governing whether an operation,
  especially signup, is allowed.
- **Ballot circuit**: the Circom public boundary that validates ballot inputs
  and exposes proof signals consumed by downstream verification.
- **Canonical representation**: the exact field ordering, widths, encoding,
  and serialization expected across TypeScript, Circom, and Cairo boundaries.

When a new feature introduces ambiguous domain terminology or changes a
protocol invariant, clarify it and record the decision here or in an ADR
instead of inventing competing names.

## Compatibility-sensitive surfaces

Treat contract entrypoints, constructor arguments, storage keys, events,
cross-contract calls, circuit signal visibility/order, witness inputs, proof
public signals, and cryptographic hash inputs as public protocol behavior.
