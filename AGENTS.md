# Engineering guidance

This repository is a Scarb workspace with two Cairo packages (`common` and
`contracts`) and one pnpm TypeScript package (`circuits`). Treat Cairo
contracts and Circom circuits as security-critical protocol code.

## Default workflow

For non-trivial work:

1. Inspect `git status`, applicable rules, `README.md`, manifests, tests,
   configuration, and nearby implementations.
2. Clarify behavior, invariants, compatibility requirements, and out-of-scope
   work. Ask before coding when ambiguity could change architecture, behavior,
   security, or public interfaces.
3. Decompose the request into the smallest independently verifiable vertical
   slices.
4. For each behavior change, use **Red -> Green -> Refactor**:
   write one focused failing test, confirm the failure is meaningful, implement
   the minimum behavior, then refactor only while green. Don't use this for prototypes unless explicitly asked.
5. Run the narrowest relevant quality gates, review the complete diff, and
   confirm no unrelated files or generated artifacts were changed.

Keep changes atomic and incremental. Preserve existing behavior, public
interfaces, storage layout, serialization, event shapes, signal ordering, and
error semantics unless the request explicitly changes them. Do not add
dependencies, layers, abstractions, or tooling without a demonstrated need.

## Design and implementation

Prefer clear, cohesive modules with small stable interfaces and explicit
boundaries. Keep domain/protocol logic independent from infrastructure where
the existing architecture permits. Search for existing types, helpers, test
fixtures, and patterns before adding new ones. In TypeScript, follow the
configured strictness, use meaningful types, and do not use `any` or unsafe
casts to silence errors.

Tests should exercise observable behavior through public APIs. Include relevant
failure, boundary, repeated-operation, and invariant cases. Never weaken,
delete, skip, or mock away the behavior under test.

## Security-sensitive code

For Cairo contracts, test authorization, validation-before-mutation and
validation-before-external-call ordering, state transitions, events,
constructor/entrypoint serialization, and failure propagation.

For Circom, test valid and invalid witnesses, boundary values, public/private
signals, field conversions, exact signal ordering, and proof verification where
applicable. Never replace a constraint with an assignment or assume successful
compilation proves circuit correctness.

## Repository quality gates

Use repository commands as the source of truth:

- `make build`
- `make test`
- `scarb test --package maci_common`
- `scarb test --package maci_contracts`
- `cd circuits && pnpm build`
- `cd circuits && pnpm test`
- `cd circuits && pnpm compile:ballot`
- `cd circuits && pnpm setup:ballot`

## Agent skills

### Issue tracker

GitHub Issues on `0xmad/maci-cairo`, via `gh`. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical roles map 1:1 to tracker labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` plus `docs/adr/`. See `docs/agents/domain.md`.
