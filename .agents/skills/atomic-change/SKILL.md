---
name: atomic-change
description: Apply the repository workflow for focused changes, validation, generated artifacts, and final diff review.
---

# Atomic Change

Use this skill when implementing, fixing, refactoring, testing, or reviewing a
repository change.

## Workflow

1. Define one coherent outcome and list required and out-of-scope work.
2. Run `git status` and preserve pre-existing worktree changes.
3. Identify the owning package, consumers, source of truth, generated outputs,
   and repository-defined validation commands.
4. Search for existing implementations, types, helpers, and dependencies before
   adding new structure.
5. Make the smallest complete implementation and add meaningful regression or
   behavior tests.
6. Validate progressively: targeted tests, affected package, direct consumers,
   and broader checks when the change warrants them.
7. Review `git status`, `git diff --stat`, `git diff`, and `git diff --check`.
8. Remove unrelated churn and rerun validation after any reduction.

## High-risk changes

For Cairo, Circom, cryptographic, protocol, serialization, persistence,
concurrency, or generated-code changes, use the relevant domain rule and
require exact representations, known-answer vectors, round trips, or invariant
tests as appropriate.

## Scope decisions

Keep a refactor, dependency change, configuration change, or documentation
change in scope only when the requested outcome is otherwise incomplete,
incorrect, or untestable. Keep public API changes compatible by default and
update only required consumers.

Do not weaken tests, suppress failures, narrow valid property domains, add
arbitrary sleeps or retries, manually patch generated output, or use
configuration changes to make an implementation pass.

## References

Use these only when the task needs additional detail:

- `references/scope-control.md`
- `references/diff-hygiene.md`
- `references/conventional-commits.md`
