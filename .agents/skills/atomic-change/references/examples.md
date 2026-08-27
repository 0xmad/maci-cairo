# Atomic Change Examples

These examples illustrate how to decide what belongs in one atomic change and what should be excluded or split.

## 1. Simple feature

Task:

```text
Add validation for Poll duration.
```

Good:

```text
packages/core/src/poll.ts
packages/core/test/poll.test.ts
```

Changes:

- validate duration;
- test valid and invalid boundaries;
- preserve existing behavior.

Bad:

```text
packages/core/src/poll.ts
packages/core/test/poll.test.ts
packages/core/src/message.ts
packages/crypto/src/hash.ts
README.md
package.json
pnpm-lock.yaml
```

when the extra files contain unrelated:

- refactoring;
- dependency upgrades;
- documentation cleanup;
- crypto improvements.

Only the Poll implementation and its required validation are needed.

## 2. Feature requiring supporting changes

Task:

```text
Add a new exported message-processing API.
```

Required:

```text
implementation
→ export
→ tests
→ direct consumer updates
```

Good:

```text
packages/domain/src/message.ts
packages/domain/src/index.ts
packages/core/src/processor.ts
packages/core/test/processor.test.ts
```

provided every file is required for the new API.

This remains one atomic change because all modifications implement the same public behavior.

## 3. Feature plus opportunistic refactoring

Task:

```text
Add Poll duration validation.
```

During implementation the agent discovers:

```text
Poll contains duplicated validation helpers.
```

Bad:

```text
Add duration validation
+
extract every validation helper
+
rename validation APIs
+
reorganize Poll modules
```

Good:

```text
Implement duration validation.

Leave unrelated duplication unchanged.
```

Create a separate refactoring task for the duplication.

Exception:

If duplicated validation makes the new behavior inconsistent or impossible to implement correctly, perform only the minimum refactoring required.

## 4. Bug fix

Task:

```text
Empty input creates one empty batch.
```

Good atomic change:

```text
batching implementation
+
regression test
```

Example:

```ts
it("returns no batches for empty input", () => {
  expect(createBatches([])).toEqual([]);
});
```

Bad:

```text
bug fix
+
batching refactor
+
new utility framework
+
test migration
```

The regression test directly protects the bug fix. The other changes are independent.

## 5. Existing test already reproduces the bug

Suppose an existing test already fails:

```ts
it("returns no batches for empty input", () => {
  // ...
});
```

The bug fix does not require a second test.

Good:

```text
existing failing test
+
minimal implementation fix
```

Do not add duplicate regression tests merely to demonstrate TDD.

## 6. Test-only change

Task:

```text
Add property-based coverage for Poll duration.
```

Good:

```text
poll.property.test.ts
```

and any genuinely required test helper or arbitrary.

Bad:

```text
property test
+
production refactor
+
new domain abstraction
```

unless those production changes are actually required by the behavior being tested.

## 7. Property-based generator change

Suppose an arbitrary generates invalid Polls even though the property requires valid Polls.

Good:

```text
Improve the Poll arbitrary so it constructs valid Polls.
```

Potentially in scope:

```text
poll.property.test.ts
test-utils/poll-arbitrary.ts
```

only when the shared arbitrary must change.

Bad:

```text
Change the arbitrary
+
rewrite unrelated arbitraries
+
increase all numRuns
+
migrate the property-test framework
```

## 8. Never shrink scope by weakening tests

Task:

```text
Fix failing property.
```

Bad:

```diff
-fc.assert(property, { numRuns: 1000 })
+fc.assert(property, { numRuns: 10 })
```

or:

```ts
fc.pre(input.length > 5);
```

when the property should cover all valid inputs.

Also bad:

```text
remove the property
```

because it exposes the bug.

Good:

```text
inspect counterexample
→ diagnose root cause
→ fix implementation
→ keep property strong
```

## 9. Refactoring task

Task:

```text
Extract Message validation into a dedicated module.
```

Good:

```text
message.ts
message-validation.ts
message.test.ts
```

provided the changes are necessary for that structural goal.

Bad:

```text
extract validation
+
rename Message APIs
+
rewrite error handling
+
upgrade dependencies
```

unless those are independently required by the refactor.

## 10. Refactor that requires tests

A behavior-preserving refactor may legitimately change:

```text
production code
+
existing test structure
```

when tests must follow the new structure.

Preserve:

- assertions;
- scenarios;
- regression coverage;
- property invariants.

Do not simplify tests by deleting coverage.

## 11. Public API change

Task:

```text
Replace positional processing flags with ProcessOptions.
```

Potentially atomic:

```text
shared API
+
required consumers
+
tests
+
documentation
+
migration guidance
```

because all changes are consequences of one API migration.

Not atomic:

```text
API migration
+
unrelated type cleanup
+
crypto refactor
+
dependency upgrades
```

## 12. Package-local change

Task:

```text
Fix message parsing in packages/core.
```

Good:

```text
packages/core/src/parser.ts
packages/core/test/parser.test.ts
```

Potentially required:

```text
packages/domain/src/message.ts
```

if the shared domain type must change.

Bad:

```text
packages/sdk
packages/cli
packages/crypto
```

when they do not need updates.

## 13. Cross-package change

A change can be atomic across several packages.

Example:

```text
packages/domain
    ↓ shared type change
packages/core
    ↓ required consumer update
packages/sdk
    ↓ required public API update
```

This is one atomic change when every package change is required for the same intentional contract.

The 20-file rule still requires scope review.

## 14. Dependency temptation

Task:

```text
Parse a value.
```

The agent discovers a library that makes parsing easier.

Bad:

```text
add dependency
+
implement parser
```

when existing dependencies or repository utilities can solve the problem.

Good:

```text
search existing utilities/dependencies
→ implement using existing infrastructure
```

Add a dependency only when it is genuinely necessary.

## 15. Necessary dependency

Suppose the task explicitly requires a new parser implementation unavailable from existing dependencies.

Then:

```text
package.json
pnpm-lock.yaml
implementation
tests
```

can be one atomic change.

The dependency is part of the same implementation requirement.

Do not add unrelated dependency upgrades.

## 16. Generated files

Task:

```text
Add a field to a protocol schema.
```

Repository workflow:

```text
schema
→ generator
→ generated TypeScript
```

Good:

```text
modify schema
→ run generator
→ include required generated output
```

Bad:

```text
manually edit generated TypeScript
```

or:

```text
regenerate repository
→ commit unrelated generated changes
```

Generated files are in scope only when produced by the required source change.

## 17. Documentation with a feature

Task:

```text
Add public message decoding API.
```

Good atomic change:

```text
implementation
+
tests
+
API documentation
+
usage example
```

The documentation directly describes the new public behavior.

Bad:

```text
feature
+
rewrite package README
+
reorganize documentation site
+
add docs to tests
```

The latter contains unrelated documentation work.

## 18. Documentation-only change

Task:

```text
Document message decoding.
```

Good:

```text
docs(sdk): document message decoding
```

with only the relevant documentation changes.

Bad:

```text
document message decoding
+
rewrite unrelated READMEs
+
rename examples everywhere
```

## 19. Do not document tests

Even when test behavior is complicated:

```ts
it("preserves the batch conservation invariant", () => {
  // ...
});
```

do not add JSDoc/TSDoc solely because the code is a test.

The test name and implementation should communicate the scenario.

Document the production invariant on the production API when appropriate.

## 20. Formatting noise

Task:

```text
Add one method to MessageProcessor.
```

Agent runs a broad formatter.

Result:

```text
35 changed files
```

Bad:

```text
commit all formatter output
```

Good:

```text
inspect diff
→ retain formatting required for changed code
→ revert unrelated formatting
→ rerun validation
```

## 21. Unrelated lint failures

Task:

```text
Add Poll validation.
```

Another package already has:

```text
no-console
```

failure.

Bad:

```text
fix unrelated package lint error
```

Good:

```text
validate affected package
→ determine unrelated failure is pre-existing
→ leave it unchanged
→ report it
```

## 22. Configuration changes

Task:

```text
Implement a TypeScript feature.
```

Agent encounters a lint error.

Bad:

```text
modify .eslintrc.js
```

to make the implementation pass.

Good:

```text
fix implementation according to repository configuration
```

Configuration changes are in scope only when explicitly required or when configuration itself is the task.

## 23. API compatibility

Task:

```text
Add an optional processing mode.
```

Existing:

```ts
process(message: Message): Result;
```

Do not automatically change every related API.

First determine the smallest compatible design.

Potentially:

```ts
process(
  message: Message,
  options?: ProcessOptions,
): Result;
```

Only change additional consumers that actually need the new contract.

## 24. Stop condition

Task:

```text
Extract validation into a dedicated module.
```

After:

```text
validation isolated
tests pass
property tests pass
typecheck passes
lint passes
diff is clean
```

Stop.

Do not continue with:

```text
parser cleanup
crypto cleanup
module renaming
dependency upgrades
```

because those improvements are visible.

## 25. Scope expansion discovered during implementation

Suppose the requested feature cannot work correctly because a shared type is wrong.

Then:

```text
feature
+
required shared type correction
```

may remain one atomic change.

The agent should be able to explain:

```text
The shared type must change because otherwise the requested behavior
cannot be represented correctly.
```

That is a valid scope expansion.

## 26. Scope reduction

Suppose the initial plan includes:

```text
new helper
new utility module
```

but repository search reveals an existing helper that already provides the needed behavior.

Remove the unnecessary work.

Better:

```text
reuse existing helper
+
feature implementation
+
tests
```

Atomic scope should become smaller when possible.

## 27. Twenty-file warning

Suppose a feature reaches:

```text
22 changed files
```

Review:

```text
Are all 22 required?
Are generated files involved?
Are these direct consumers?
Did formatting expand the diff?
Did cleanup sneak in?
Can independent work be split?
```

If all 22 are necessary for one cross-package change:

```text
keep atomic
+
document why
```

If not:

```text
split the work
```

## 28. Bad 20-file example

Task:

```text
Add Poll duration validation.
```

Diff includes:

```text
Poll validation
Poll tests
Message refactor
Crypto cleanup
Dependency upgrades
README rewrite
Test framework migration
```

This is not a coherent atomic change.

Split into separate tasks or PRs.

## 29. Good 20-file example

Task:

```text
Migrate Message API from version 1 to version 2.
```

Changes:

```text
shared type definitions
producer package
consumer packages
serialization compatibility layer
tests
property tests
documentation
migration examples
generated bindings
```

Twenty or more files may be justified because they are all required by one API migration.

The file count triggers review but does not automatically invalidate the change.

## 30. Debugging task

Task:

```text
Fix duplicate concurrent processing.
```

Good:

```text
root-cause implementation change
+
regression test
+
relevant property test
```

Bad:

```text
bug fix
+
async framework migration
+
unrelated timeout cleanup
+
dependency update
```

## 31. High-risk protocol change

Task:

```text
Change message serialization.
```

Required supporting validation may include:

```text
serialization implementation
known-answer tests
property-based round-trip tests
consumer compatibility tests
documentation
```

These can remain one atomic change because serialization correctness requires all of them.

Do not omit validation merely to keep file count low.

## 32. Commit message versus atomic scope

A commit message such as:

```text
feat(poll): add duration validation
```

does not make the change atomic.

The actual diff must still contain only:

```text
Poll duration feature
+
required tests
+
required supporting changes
```

Conventional Commits describe the change.

They do not define whether the scope is actually coherent.

## 33. Good agent behavior

```text
Task:
Add duration validation.

Agent:

1. Inspect repository/package.
2. Search existing Poll validation.
3. Inspect tests.
4. Add smallest test.
5. Implement validation.
6. Run targeted tests.
7. Run property tests if applicable.
8. Run typecheck/lint/format.
9. Inspect git diff.
10. Revert unrelated changes.
11. Stop.
```

## 34. Bad agent behavior

```text
Task:
Add duration validation.

Agent:

1. Edit Poll.
2. Refactor Poll.
3. Rename Message.
4. Upgrade TypeScript.
5. Rewrite tests.
6. Run formatter globally.
7. Add a dependency.
8. Modify ESLint configuration.
9. Delete failing property.
10. Commit everything.
```

This violates atomic scope and validation integrity.

## 35. Final atomicity test

A change is probably atomic when:

```text
Every changed file
    ↓
supports one purpose
    ↓
tests protect that purpose
    ↓
supporting changes are necessary
    ↓
no unrelated cleanup remains
```

A change is probably not atomic when:

```text
one requested task
    ↓
multiple independent improvements
    ↓
unrelated dependencies
    ↓
broad cleanup
    ↓
large unexplained diff
```

## 36. Final review

Before completion:

```text
[ ] I can describe the change in one sentence.
[ ] Every changed file supports that sentence.
[ ] Existing code was searched before adding abstractions.
[ ] Required tests are included.
[ ] Existing test strength was preserved.
[ ] Property-test strength was preserved.
[ ] Public API changes are intentional.
[ ] Dependencies changed only when required.
[ ] Generated files are attributable to source changes.
[ ] Formatting is scoped.
[ ] No unrelated cleanup remains.
[ ] No speculative architecture remains.
[ ] 20+ files triggered a scope review.
[ ] Independent work was split where practical.
[ ] Final diff was reviewed.
[ ] Validation was rerun after final diff cleanup.
```

## 37. Desired outcome

The ideal result is:

```text
one coherent purpose
+
minimum complete implementation
+
meaningful tests
+
required supporting changes
+
clean diff
+
validated behavior
```

Atomicity means **smallest complete change**, not smallest possible number of files.
