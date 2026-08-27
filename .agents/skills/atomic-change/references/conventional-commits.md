# Conventional Commits

Use this reference when creating or reviewing commit messages for an atomic change.

The goal is for each commit message to accurately describe the commit's primary purpose and remain consistent with the repository's Conventional Commits policy.

## 1. Required format

Use:

```text
<type>(<optional scope>): <description>
```

Examples:

```text
feat(poll): add duration validation
fix(message): reject malformed messages
refactor(crypto): isolate serialization logic
test(poll): add duration property tests
docs(api): document message validation
```

The scope is optional.

## 2. Commit type must match the actual change

Use the type that describes the primary purpose:

| Type       | Use for                                    |
| ---------- | ------------------------------------------ |
| `feat`     | New user-visible or API functionality      |
| `fix`      | Correcting incorrect behavior              |
| `refactor` | Behavior-preserving structural changes     |
| `test`     | Test-only changes                          |
| `docs`     | Documentation-only changes                 |
| `build`    | Build system or dependency changes         |
| `ci`       | CI configuration/workflow changes          |
| `perf`     | Performance improvements                   |
| `style`    | Formatting/style-only changes              |
| `chore`    | Maintenance that does not fit another type |

Do not choose a type based on convenience.

## 3. Do not mislabel behavior changes

A change is not a `refactor` merely because the implementation was reorganized.

Use:

```text
fix(...)
```

when behavior is corrected.

Use:

```text
feat(...)
```

when behavior is added.

Use:

```text
refactor(...)
```

only when intended behavior remains unchanged.

Bad:

```text
refactor(poll): change duration validation
```

when the change alters which durations are accepted.

Better:

```text
fix(poll): reject non-positive durations
```

## 4. Use `test` for test-only commits

Examples:

```text
test(poll): cover invalid duration
test(message): add duplicate-message regression
test(crypto): add serialization properties
```

If implementation changes as part of the same coherent change, use the type representing the primary purpose.

For example:

```text
fix(poll): reject invalid durations
```

rather than:

```text
test(poll): add invalid duration validation
```

when production behavior is being changed.

## 5. Use `docs` for documentation-only commits

Examples:

```text
docs(api): document message decoding
docs(core): explain state transition invariants
docs: update package setup instructions
```

Do not use `docs` when documentation is merely part of a behavior change.

For example:

```text
feat(sdk): add message decoding API
```

may include the corresponding API documentation.

## 6. Use `refactor` only for behavior-preserving changes

Good:

```text
refactor(message): extract validation helper
refactor(poll): isolate state transition logic
refactor(crypto): split serialization implementation
```

The observable behavior should remain unchanged.

If behavior changes, use `feat` or `fix` as appropriate.

## 7. Use `build` for dependency/build changes

Examples:

```text
build(workspace): update TypeScript dependency
build(core): add required runtime dependency
build: update pnpm lockfile
```

Do not hide dependency upgrades inside:

```text
feat(...)
```

or:

```text
refactor(...)
```

unless the dependency change is inseparable from the primary change and the repository workflow explicitly permits that convention.

Prefer separating independent dependency changes.

## 8. Use `ci` for CI changes

Examples:

```text
ci: run package tests in parallel
ci(core): add TypeScript validation
ci: update GitHub Actions runtime
```

Do not use `build` when the primary change is CI workflow behavior.

## 9. Use `perf` for performance changes

Examples:

```text
perf(crypto): reduce redundant hashing
perf(poll): avoid repeated state traversal
```

A performance improvement should actually target performance.

Do not use `perf` as a label for ordinary cleanup.

## 10. Use `style` only for style-only changes

Examples:

```text
style: format TypeScript sources
style(core): normalize import formatting
```

Do not use `style` when behavior changes.

A change that fixes lint by modifying implementation semantics is not a `style` commit.

## 11. Use `chore` carefully

Use `chore` for maintenance work that does not fit a more specific type.

Examples:

```text
chore: update repository metadata
chore(tooling): clean obsolete configuration
```

Prefer a more specific type when one exists.

For example:

```text
build: update dependency
```

is more informative than:

```text
chore: update dependency
```

## 12. Scope names

Use a scope when it improves clarity.

Good:

```text
feat(poll): add duration validation
fix(message): preserve message ordering
refactor(crypto): isolate encoder
```

Possible scopes include:

```text
poll
message
crypto
sdk
core
domain
workspace
```

Use terminology already established by the repository.

Do not invent inconsistent scope names.

## 13. Avoid overly broad scopes

Avoid:

```text
feat(project): improve things
```

when a more precise scope exists.

Prefer:

```text
feat(poll): add duration validation
```

The scope should help identify the affected domain/package.

## 14. Description should be concise

Prefer:

```text
fix(message): reject duplicate messages
```

Avoid:

```text
fix(message): make some changes to the message processing code so that duplicate messages are hopefully handled correctly
```

The commit body can contain additional explanation when needed.

## 15. Use imperative descriptions

Prefer:

```text
add
fix
remove
update
extract
preserve
validate
```

Examples:

```text
feat(poll): add duration validation
fix(message): reject malformed input
refactor(parser): extract validation logic
test(poll): cover boundary durations
```

Avoid vague descriptions such as:

```text
updated poll
fixed stuff
changes
misc updates
work
```

## 16. Do not end descriptions with unnecessary punctuation

Prefer:

```text
fix(message): reject duplicate messages
```

rather than:

```text
fix(message): reject duplicate messages.
```

Follow repository conventions if they explicitly differ.

## 17. Keep the commit message aligned with the diff

The commit message should describe what the commit actually changes.

If the diff contains:

```text
production fix
+
unrelated refactor
```

changing the commit message does not make it atomic.

Fix the scope instead.

## 18. One coherent commit purpose

An atomic commit should answer one primary question.

Good:

```text
fix(poll): reject non-positive duration
```

Bad:

```text
fix(poll): reject non-positive duration and refactor crypto utilities
```

Split unrelated work.

## 19. Test-first commit sequences

When the workflow uses separate commits for TDD stages, a possible sequence is:

```text
test(poll): specify invalid duration behavior
fix(poll): reject non-positive duration
```

The repository may instead prefer squashing these into one final commit.

Follow the actual project workflow.

The Conventional Commit type must still accurately describe each commit.

## 20. Refactor followed by feature

When both are genuinely independent:

```text
refactor(message): extract validation helper
feat(message): reject malformed messages
```

Do not combine them merely because the feature became easier after the refactor.

## 21. Bug fix with regression test

A bug fix may include its regression test in the same commit:

```text
fix(message): reject duplicate messages
```

The commit can contain:

```text
implementation
+
regression test
```

The primary purpose is still the bug fix.

Alternatively, when the repository uses separate test-first commits:

```text
test(message): reproduce duplicate-message bug
fix(message): reject duplicate messages
```

## 22. Property-based test commits

Test-only property changes can use:

```text
test(poll): add duration invariant properties
```

If the property is added as part of a feature:

```text
feat(poll): validate duration
```

and the property belongs to that feature's validation.

Do not label production behavior changes as `test` merely because the tests are substantial.

## 23. Documentation with implementation

When implementation and documentation are part of the same feature:

```text
feat(sdk): add message decoding API
```

not:

```text
docs(sdk): add message decoding API
```

unless the change is genuinely documentation-only.

## 24. Dependency change with feature

If a dependency is genuinely required by a feature, the feature commit may include it when that is consistent with repository workflow:

```text
feat(sdk): add message parser
```

However, independent dependency upgrades should be separated:

```text
build: upgrade fast-check
```

Avoid opportunistic dependency upgrades inside feature commits.

## 25. Generated files

Generated output should use the commit type of the source change.

For example:

```text
feat(protocol): add message field
```

can contain required generated artifacts.

Do not create a misleading commit such as:

```text
chore: regenerate files
```

when the generation is actually part of a protocol feature.

A standalone regeneration with no functional source change may appropriately use `chore` or `build`, depending on repository convention.

## 26. Breaking changes

When an API change is intentionally breaking, document that clearly.

Conventional Commits supports indicating a breaking change with:

```text
feat(api)!: change message processing signature
```

or a commit body/footer such as:

```text
BREAKING CHANGE: process() now requires ...
```

Use the repository's established convention.

Do not introduce breaking API changes merely because the syntax is supported.

## 27. Breaking change does not excuse broad scope

A breaking API migration may legitimately touch many files:

```text
producer
+
direct consumers
+
tests
+
documentation
```

It can still be atomic.

However, unrelated cleanup remains out of scope.

## 28. 20-file warning

A commit or PR touching **20 or more files** should trigger scope reassessment.

Ask:

```text
Are all files required?

Is this one coherent migration?

Did unrelated cleanup sneak in?

Did formatting create noise?

Did a dependency change become mixed in?

Can independent work be split?
```

Do not artificially reduce the count by weakening tests or hiding changes.

## 29. Commit message review

Before committing, verify:

```text
[ ] type matches primary purpose
[ ] scope is accurate
[ ] description is concise
[ ] description uses imperative wording
[ ] commit does not hide unrelated work
[ ] behavior change is not mislabeled as refactor
[ ] test-only change is labeled test
[ ] documentation-only change is labeled docs
[ ] dependency/build change is labeled build
```

## 30. Common bad messages

Avoid:

```text
update
changes
fix
fix stuff
misc
work
wip
cleanup
typescript changes
more fixes
```

These make repository history difficult to understand.

Prefer:

```text
fix(message): reject duplicate messages
refactor(poll): extract validation logic
test(crypto): cover serialization round trip
docs(sdk): document message decoding
build(workspace): update dependency
```

## 31. Commit body

For complex changes, the body can explain:

```text
why the change is necessary;
what important behavior changed;
compatibility implications;
known limitations.
```

Example:

```text
fix(poll): reject non-positive durations

Poll creation previously accepted zero-duration polls, which produced an
invalid state for downstream processing.

Add validation at construction and cover the boundary with unit and
property-based tests.
```

Keep the title concise.

## 32. Avoid implementation narration

The commit message should describe intent and meaningful behavior, not every implementation detail.

Bad:

```text
fix(poll): add if statement before assigning duration variable
```

Better:

```text
fix(poll): reject non-positive durations
```

## 33. Commit message and atomic-change review

A useful consistency check is:

```text
commit title
    ↓
changed files
    ↓
tests
    ↓
final behavior
```

These should tell the same story.

If the title says:

```text
refactor(message): extract validation logic
```

but the diff also changes validation behavior, the commit is misleading.

## 34. Commit message and PR title

The PR title and commit messages do not have to be identical.

The PR should summarize the coherent change.

Individual commits may represent implementation steps:

```text
test(poll): specify duration behavior
feat(poll): validate duration
docs(poll): document duration constraints
```

The final PR could be:

```text
Validate Poll duration
```

Follow repository workflow for squashing/rebasing.

## 35. Conventional Commits do not replace atomicity

A perfectly formatted commit can still be non-atomic.

Example:

```text
refactor: improve code
```

could contain:

```text
feature
+
dependency upgrade
+
test migration
+
unrelated cleanup
```

The commit type does not solve the scope problem.

The diff must still be coherent.

## 36. Suggested workflow

```text
1. Define task scope.
2. Implement the change.
3. Run relevant tests.
4. Run property tests when applicable.
5. Run typecheck.
6. Run lint.
7. Review git diff.
8. Review changed-file count.
9. Split unrelated work.
10. Choose Conventional Commit type.
11. Write concise commit message.
12. Review commit against diff.
```

## 37. Completion checklist

```text
[ ] Commit has one primary purpose
[ ] Type matches the primary purpose
[ ] Scope matches repository terminology
[ ] Description is concise
[ ] Description is imperative
[ ] No vague wording
[ ] No unrelated changes are hidden in the commit
[ ] Behavior changes are not labeled refactor
[ ] Test-only changes use test
[ ] Documentation-only changes use docs
[ ] Dependency/build changes use build
[ ] 20+ file warning reviewed
[ ] Required validation actually ran
```

## 38. Completion report

```text
Commit:

<type>(<optional scope>): <description>

Primary purpose:
<one sentence>

Changed files:
<N>

20+ file review:
PASS / NOT APPLICABLE

Validation:
- tests: PASS/FAIL/NOT RUN
- property tests: PASS/FAIL/NOT RUN
- TypeScript: PASS/FAIL/NOT RUN
- ESLint: PASS/FAIL/NOT RUN
- Prettier: PASS/FAIL/NOT RUN

Scope:
atomic / requires further splitting

Notes:
<relevant limitations>
```

Never report `PASS` for validation that was not actually executed.
