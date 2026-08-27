# Diff Hygiene

Use this reference after implementation, formatting, refactoring, debugging, or generated-code changes to verify that the final diff contains only changes required for the task.

The goal is a diff that is easy to understand, review, test, revert, and attribute to one coherent change.

## 1. Diff hygiene is mandatory

Before completion, always inspect:

```bash
git status
git diff --stat
git diff
```

Do not declare an atomic change complete without reviewing the actual diff.

## 2. Start with `git status`

Run:

```bash
git status
```

Check:

- modified files;
- deleted files;
- added files;
- renamed files;
- untracked files;
- generated artifacts.

Every changed file should have an explanation.

## 3. Inspect diff size

Run:

```bash
git diff --stat
```

Use the result as a scope signal.

Example:

```text
Task:
Add validation to one function.

Expected:
2–4 files.

Actual:
31 files.
```

This requires investigation before completion.

A large diff is not automatically wrong, but it should be explainable.

## 4. 20-file warning

If the change reaches:

```text
20 or more changed files
```

stop and reassess.

Ask:

```text
Are all files required?

Did formatting cause the expansion?

Did generated artifacts expand the diff?

Did refactoring become broader than necessary?

Did unrelated cleanup sneak in?

Can independent changes be split?
```

A 20+ file change is acceptable only when the files genuinely belong to one coherent change.

## 5. Inspect the full diff

Run:

```bash
git diff
```

Do not rely only on:

```bash
git diff --stat
```

The stat shows where changes exist.

The full diff shows whether the changes are justified.

## 6. Every changed line needs a reason

For each changed section, ask:

```text
What task requirement caused this line to change?
```

Valid reasons include:

```text
required behavior
required test
required type
required export
required API migration
required generated output
required documentation
required configuration
required formatting of changed code
```

Suspicious reasons include:

```text
cleaner
more idiomatic
nearby
old
could be improved
agent preference
```

## 7. Detect unrelated formatting churn

Formatting can create noise such as:

```diff
-const value = foo();
+const value = foo()
```

across unrelated sections.

Or:

```text
one source change
→ entire file reformatted
```

Determine whether the repository formatter actually requires the changes.

If not, revert unrelated formatting.

Do not manually fight formatter output when the changed code itself requires formatting.

## 8. Formatter configuration must remain authoritative

If the diff contains unexpected formatting:

1. Inspect `.prettierrc`.
2. Inspect ESLint/Prettier integration.
3. Run the repository formatter on the relevant file.
4. Compare the resulting diff.
5. Keep only necessary changes.

Do not change `.prettierrc` merely to reduce diff size.

## 9. Detect unrelated import reordering

Import changes are often caused by formatting or lint fixes.

Ask:

```text
Was this import changed because the task required it?

Was it required because another import was added/removed?

Did the formatter reorder the entire file?
```

Keep required import changes.

Revert unrelated import churn where possible.

## 10. Detect opportunistic refactoring

Watch for changes such as:

```diff
-function processMessage(...) {
+function process(...) {
```

or:

```text
extract helper
rename variables
restructure class
change module boundaries
```

during a task that did not require them.

If the refactor is not necessary for the task, remove it.

## 11. Detect unrelated renames

Broad renames create large diffs and obscure behavior changes.

Check whether a rename:

- is required for the task;
- changes public API;
- changes serialization;
- changes package exports;
- affects downstream consumers.

Do not rename unrelated identifiers merely to improve naming consistency.

## 12. Detect accidental API changes

Search the diff for:

```text
export
public
interface
type
class
constructor
function signature
package exports
```

Ask:

```text
Did this task require an API change?

Did the exported type change?

Did optionality change?

Did return types change?

Did constructor signatures change?

Did package consumers need updates?
```

An unintended public API change is a serious diff-hygiene issue.

## 13. Detect type weakening

Look for suspicious changes:

```diff
-Message
+unknown
```

```diff
-PollConfig
+Record<string, unknown>
```

```diff
-Thing
+any
```

or:

```diff
-requiredProperty: Type
+requiredProperty?: Type
```

These may indicate the agent changed the type contract to make implementation easier.

Do not accept type weakening as diff cleanup.

## 14. Search for validation suppressions

Inspect the diff for:

```text
eslint-disable
eslint-disable-next-line
@ts-ignore
@ts-expect-error
any
no-check
skip
only
```

These are not automatically forbidden in every repository context, but new suppressions require explicit justification.

For this repository's agent workflow, they should normally be treated as suspicious.

## 15. Test diff review

Inspect changed tests separately.

Ask:

```text
Did I add meaningful coverage?

Did I remove assertions?

Did I weaken assertions?

Did I change expected values because implementation failed?

Did I alter fixtures to hide failures?

Did I reduce property-test input space?

Did I reduce numRuns?

Did I add retries or sleeps?
```

A test diff that makes failures disappear without fixing behavior is invalid.

## 16. Property-test diff review

For fast-check changes, inspect:

```text
arbitrary
property
numRuns
fc.pre
noShrink
assertions
```

Be especially suspicious of:

```diff
+fc.pre(...)
```

after a failure or:

```diff
-numRuns: 1000
+numRuns: 10
```

when the motivation is to avoid failures or performance problems that were not investigated.

## 17. Coverage-related diff review

Watch for:

```text
coverage thresholds
coverage excludes
test-path exclusions
new ignored files
```

Do not reduce coverage configuration to make the change pass.

Coverage is a quality signal, not a metric to game.

## 18. Dependency diff review

Inspect:

```text
package.json
pnpm-lock.yaml
workspace dependency declarations
```

For every dependency change ask:

```text
Why is this dependency required?

Was it explicitly requested?

Could the repository's existing dependencies solve the problem?

Was the upgrade opportunistic?
```

If the task did not require a dependency change, remove it.

## 19. Lockfile diff review

A small package change can sometimes produce a large lockfile diff.

Inspect:

```bash
git diff pnpm-lock.yaml
```

Determine whether every lockfile change is a consequence of an intentional dependency change.

Unexpected lockfile churn should be investigated.

## 20. Generated-file diff review

When generated files are changed:

```text
source change
→ generator
→ generated output
```

verify that the generated diff corresponds exactly to the source change.

Watch for:

```text
timestamps
unrelated generated artifacts
formatting changes
environment-specific output
tool-version churn
```

Do not manually edit generated files merely to make the diff smaller.

## 21. Documentation diff review

When documentation changes:

Check:

```text
public API documentation
README
examples
migration notes
generated docs
```

Ensure:

- documentation reflects actual behavior;
- examples use current APIs;
- unrelated docs are untouched;
- tests did not receive unnecessary documentation;
- generated docs come from the source workflow.

## 22. Debugging diff review

For bug fixes, make sure the diff contains:

```text
root-cause fix
+
regression coverage
+
required supporting changes
```

Be suspicious if it instead contains:

```text
root-cause fix
+
large refactor
+
dependency upgrade
+
test rewrite
+
formatting cleanup
```

The latter likely contains scope drift.

## 23. Refactoring diff review

For refactors, ask:

```text
Does behavior remain unchanged?

Is the structural goal clear?

Did the refactor expand into unrelated cleanup?

Did public APIs change?

Did test behavior change?

Did concurrency change?

Did serialization change?
```

A refactor should be explainable without mixing it with feature work.

## 24. Async diff review

When async code changes, inspect carefully for:

```text
await added/removed
Promise.all introduced
Promise.all removed
retry logic
timeout changes
catch handlers
resource cleanup
event listeners
concurrency changes
```

These can change behavior even when the diff looks small.

## 25. Generated artifacts and protocol code

For cryptographic, ZK, blockchain, or protocol code, inspect exact data changes.

Pay particular attention to:

```text
field ordering
serialization
encoding
hash inputs
commitments
nullifiers
proof inputs
state transition data
```

A visually small diff may have a large semantic impact.

## 26. Check for whitespace-only changes

Use the diff to identify changes where:

```text
logic unchanged
format changed
```

Whitespace-only changes may be legitimate when required by formatting.

Otherwise avoid them.

Useful commands include:

```bash
git diff --check
```

and:

```bash
git diff --word-diff
```

when appropriate.

## 27. Check for whitespace errors

Run:

```bash
git diff --check
```

This can identify:

- trailing whitespace;
- conflict markers;
- malformed patches.

Fix these before completion.

## 28. Review untracked files

`git status` may show:

```text
?? temp.txt
?? debug-output.json
?? generated-debug/
```

Determine whether each untracked file is:

```text
required artifact
temporary diagnostic
accidental output
```

Remove temporary artifacts.

Do not leave debugging files in the change.

## 29. Review deleted files

A deletion should be justified.

Ask:

```text
Was the file intentionally removed?

Does another package consume it?

Is it generated?

Is it part of a public API?

Was it deleted merely because the agent considered it unused?
```

Do not delete potentially public or dynamically consumed files based only on local references.

## 30. Review renamed files

A rename may affect:

```text
imports
package exports
case sensitivity
documentation links
generated paths
build configuration
```

Check all consumers before accepting a rename.

## 31. Detect accidental broad formatting

A common agent failure is:

```text
modify one function
→ run formatter incorrectly
→ entire file changes
```

If that happens:

```text
inspect formatter behavior
→ determine required changes
→ revert unrelated sections
→ format correctly
→ rerun validation
```

Do not accept large formatting changes merely because they are technically valid.

## 32. Diff against the task, not against perfection

The goal is not:

```text
make the repository perfect
```

The goal is:

```text
make the requested change correctly
```

A diff may contain existing imperfections.

Do not "fix" all of them.

## 33. Use `git diff` as a causal check

For every cluster of changes, ask:

```text
What caused this?

Is the cause still part of the task?

Would the implementation work without it?
```

If the answer to the final question is yes, consider removing the change.

## 34. Final diff reduction

Before completion, perform one deliberate reduction pass:

```text
implementation complete
→ inspect diff
→ identify unnecessary changes
→ revert unnecessary changes
→ rerun relevant validation
→ inspect diff again
```

Do not remove required tests, validation, or supporting changes simply to make the diff smaller.

## 35. Re-run validation after diff reduction

After reverting unnecessary changes:

```text
targeted tests
→ property tests
→ typecheck
→ lint
→ format
```

Run whatever validation is appropriate for the repository/task.

A diff reduction can accidentally remove a required change.

## 36. Final review checklist

```text
[ ] git status reviewed
[ ] git diff --stat reviewed
[ ] git diff reviewed
[ ] git diff --check passed
[ ] every changed file has a purpose
[ ] every changed section supports the task
[ ] no unrelated formatting
[ ] no unrelated refactoring
[ ] no broad renaming
[ ] no accidental API changes
[ ] no weakened types
[ ] no test weakening
[ ] no property weakening
[ ] no unnecessary dependency changes
[ ] no unexplained lockfile churn
[ ] generated output is attributable to source changes
[ ] no debug artifacts remain
[ ] 20+ file warning reviewed
[ ] required validation was rerun after final diff cleanup
```

## 37. Final questions

Before declaring the diff clean:

```text
1. Why did every changed file change?
2. Why did every changed code section change?
3. What requirement does each change satisfy?
4. Did formatting create unrelated changes?
5. Did refactoring sneak into the task?
6. Did any public API change accidentally?
7. Did test strength remain unchanged or improve?
8. Did property-test strength remain unchanged or improve?
9. Did any dependency change occur without necessity?
10. Did generated output expand unexpectedly?
11. Are all remaining failures attributable to the current change?
12. Is the change below 20 files, or is there a concrete reason it exceeds it?
13. Could any remaining change be moved to a separate task?
14. Is the final diff easy for another engineer to understand?
```

## 38. Completion report

```text
Diff review:

Files changed:
<N>

20+ file review:
PASS / NOT APPLICABLE

Unrelated changes:
none / <details>

Formatting churn:
none / <details>

Generated changes:
none / <details>

Dependency changes:
none / <details>

API changes:
none / <details>

Validation:
- git diff --check: PASS/FAIL/NOT RUN
- tests: PASS/FAIL/NOT RUN
- property tests: PASS/FAIL/NOT RUN
- TypeScript: PASS/FAIL/NOT RUN
- ESLint: PASS/FAIL/NOT RUN
- Prettier: PASS/FAIL/NOT RUN

Conclusion:
clean / requires further scope reduction
```

Never report `PASS` for validation that was not actually executed.
