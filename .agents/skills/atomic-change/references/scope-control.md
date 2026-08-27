# Atomic Change Scope Control

Use this reference when deciding whether a file, code section, dependency, test, configuration change, or generated artifact belongs in the current atomic change.

The goal is to keep the change focused without artificially restricting changes that are genuinely required.

## 1. Primary scope rule

Every change should answer one question:

> What single coherent outcome is this change implementing?

A change belongs in scope when it is necessary to make that outcome correct and complete.

A change is out of scope when it is merely useful, cleaner, newer, or nearby.

## 2. Scope decision test

For every proposed change ask:

```text
Is this required for the requested behavior?

        │
        ├── Yes → likely in scope
        │
        └── No
             │
             ├── Explicitly requested?
             │      ├── Yes → in scope
             │      └── No
             │
             └── Keep out of this change
```

The key question is:

> Would the requested behavior be incomplete, incorrect, or untestable without this change?

If no, leave it out.

## 3. Define scope before editing

Before implementation, establish:

```text
Purpose:
<one sentence>

Affected package:
<package>

Required files:
<initial set>

Required behavior:
<behavior>

Required tests:
<tests>

Potential API impact:
<impact>

Known out of scope:
<items>
```

This is an initial boundary, not an absolute prohibition.

New information can expand scope when the additional change is genuinely necessary.

## 4. Causal relevance beats proximity

Do not include code because it is:

- in the same file;
- in the same class;
- in the same package;
- nearby in the call graph;
- easy to improve while editing.

Example:

```text
Task:
Add validation to Message.

Found:
An unrelated helper has confusing naming.
```

The helper remains unchanged unless its name prevents the requested implementation.

## 5. Existing-code-first scope control

Before adding a new file or abstraction:

```text
search existing repository
→ identify reusable implementation
→ determine whether reuse is appropriate
→ only create new structure if required
```

A new helper, type, module, or abstraction increases scope.

Prefer an existing equivalent when it correctly solves the task.

## 6. Required supporting changes

Supporting changes belong in the same atomic change when the requested feature cannot be complete without them.

Examples:

```text
new exported function
→ implementation
→ export declaration
→ tests
```

or:

```text
shared type change
→ producer update
→ required consumer updates
→ tests
```

These are one coherent change because they implement one contract.

## 7. Unrelated cleanup

Keep out:

```text
rename unrelated variables
remove old comments
reorganize imports across unrelated files
rewrite nearby helpers
fix unrelated lint errors
simplify unrelated tests
```

even when these changes are objectively improvements.

Create or record a separate task instead.

## 8. Opportunistic refactoring

A common agent failure is:

```text
feature request
→ discovers duplicated code
→ introduces abstraction
→ refactors callers
→ renames types
→ changes modules
```

Before allowing this, ask:

```text
Does the existing structure prevent the feature?

Does the new abstraction reduce a real correctness risk?

Would the feature be incomplete without it?
```

If not, keep the refactor separate.

## 9. Behavior changes vs refactors

Separate:

```text
feature:
add behavior
```

from:

```text
refactor:
change structure without changing behavior
```

when practical.

Bad:

```text
refactor parser
+
add parser behavior
+
change error model
```

Better:

```text
Change A:
refactor parser structure

Change B:
change parser behavior
```

when the two can be independently implemented.

## 10. Necessary refactoring exception

A refactor may remain in scope when:

```text
the current structure makes the requested change incorrect,
unsafe,
duplicated,
or impossible
```

Example:

```text
Task:
validate Message in exactly one canonical location.

Current state:
three execution paths contain independent validation.

Required:
extract shared validation to avoid inconsistent behavior.
```

The extraction is then directly related to correctness.

Keep it as small as possible.

## 11. Tests

Tests are normally part of the same atomic change when they directly specify or protect the changed behavior.

In scope:

```text
new behavior test
regression test
required property test
required integration test
```

Out of scope:

```text
test framework migration
test-directory reorganization
unrelated fixture cleanup
snapshot migration
```

unless explicitly required.

## 12. Test integrity overrides scope minimization

Do not keep a change "small" by weakening tests.

Never:

```text
delete test
remove assertion
skip test
reduce property coverage
reduce numRuns to hide failure
restrict generator to avoid failure
mock away system under test
```

The correct scope includes whatever meaningful validation is necessary.

## 13. Property-based testing scope

A property test belongs in scope when it directly validates the requested behavior or invariant.

A new feature may require:

```text
implementation
+
example tests
+
property tests
```

Do not rewrite the repository's arbitrary infrastructure unless the task genuinely requires it.

When a shared arbitrary must change, inspect its consumers before modifying it.

## 14. API changes

Before changing a public API:

```text
find exports
→ find call sites
→ find downstream packages
→ inspect serialization
→ inspect tests
```

Only change consumers that actually require the new contract.

Do not update every possible API consumer "for consistency" when it is unrelated.

## 15. API compatibility

Prefer:

```text
internal implementation change
```

over:

```text
public API change
```

when both solve the task correctly.

If a breaking change is explicitly required:

```text
producer
+
required consumer updates
+
tests
+
required documentation/migration
```

may remain one atomic change.

Unrelated API cleanup does not.

## 16. Package boundaries

For pnpm workspaces, determine:

```text
owner package
direct dependencies
direct consumers
```

A package-local task should remain package-local unless cross-package changes are required.

Example:

```text
Task:
Fix parser in packages/core.

In scope:
packages/core/src/parser.ts
packages/core/test/parser.test.ts
```

Potentially in scope:

```text
packages/domain/src/message.ts
```

if a shared type correction is necessary.

Not automatically in scope:

```text
packages/sdk
packages/cli
packages/crypto
```

unless they consume the changed contract and require updates.

## 17. Cross-package change

Multiple packages can form one atomic change.

Example:

```text
packages/domain
    ↓ shared type change

packages/core
    ↓ required consumer update

packages/sdk
    ↓ required public API update
```

This remains atomic if the three changes are inseparable parts of one intentional contract change.

The larger file count should trigger scope review, not automatic rejection.

## 18. Dependency changes

A dependency belongs in scope only when it is necessary.

Ask:

```text
Can the existing repository dependencies solve this?

Can existing code solve this?

Is the dependency explicitly requested?

Is the current failure actually caused by the dependency?
```

Do not add a package because it is convenient.

## 19. Dependency upgrades

A feature request is not permission to upgrade:

```text
TypeScript
Node
pnpm
Jest
eslint
other libraries
```

unless the task actually requires the upgrade.

Dependency upgrades increase risk and should normally be separate changes.

## 20. Lockfile changes

A lockfile change belongs in scope when it is a consequence of an intentional dependency change.

Do not:

```text
manually trim lockfile
revert required lockfile changes
regenerate unrelated dependencies
```

to make the diff look smaller.

## 21. Configuration

Configuration changes should be included only when:

- explicitly requested;
- required by the implementation;
- required to fix a demonstrated configuration defect.

Do not change:

```text
ESLint
Prettier
TypeScript
test configuration
CI
package manager
```

merely to make the implementation easier.

## 22. Generated files

Generated output belongs in scope when the requested source-of-truth change requires regeneration.

Use:

```text
source
→ official generator
→ generated output
```

Do not manually edit generated files merely to reduce scope.

If generation produces unrelated files, investigate and revert unrelated output.

## 23. Documentation

Documentation belongs in scope when it directly describes the changed public behavior.

Examples:

```text
new public API
→ API documentation
→ usage example
```

or:

```text
breaking API change
→ migration guide
```

Do not rewrite unrelated documentation in the same feature PR.

Remember the repository rule:

> Do not add documentation merely because code is a test.

## 24. Formatting

Formatting required for changed code is in scope.

Unrelated formatting is out.

If formatting changes many unrelated lines:

```text
inspect formatter configuration
→ inspect diff
→ keep necessary changes
→ revert unrelated churn
```

Do not accept a large diff simply because a formatter generated it.

## 25. Comments

Add or update comments only when the comment is required to explain:

- non-obvious behavior;
- invariants;
- protocol constraints;
- security assumptions;
- serialization requirements;
- compatibility constraints.

Do not use the task as an excuse to rewrite nearby comments.

## 26. High-risk code

For:

```text
crypto
ZK
blockchain
serialization
persistence
state transitions
concurrency
```

scope may legitimately expand to include stronger validation.

For example:

```text
implementation
+
known-answer tests
+
property test
+
serialization regression
```

These may all be required to establish correctness.

Do not interpret atomicity as a reason to omit necessary validation.

## 27. Debugging discovered issues

When debugging, distinguish:

```text
root-cause fix
```

from:

```text
additional issue discovered
```

Fix the additional issue in the current change only if:

- it is the same root cause;
- the current task explicitly includes it;
- the current fix is incomplete without it.

Otherwise report it separately.

## 28. Scope expansion during implementation

Scope can legitimately expand.

When new information appears:

```text
new discovery
→ prove necessity
→ update intended scope
→ continue
```

The agent should be able to explain:

```text
Why is this additional file/change required?
```

A useful answer is:

> Without this change, the requested behavior would remain incorrect/incomplete.

A weak answer is:

> While I was here, I noticed this could be improved.

## 29. Scope reduction

Scope should also shrink when possible.

If two changed files are no longer necessary after reusing an existing abstraction:

```text
remove them
```

The goal is not to maximize touched files.

It is to implement the task with the minimum necessary surface.

## 30. 20+ file warning

The default expectation is:

```text
< 20 changed files
```

When the change reaches:

```text
20 or more changed files
```

perform a scope review.

Ask:

```text
Are all files required?

Did unrelated cleanup sneak in?

Did a formatter create noise?

Did generated artifacts expand the change?

Did a refactor become broader than necessary?

Can independent package changes be separated?

Can documentation be separated?

Can dependency changes be separated?
```

A 20+ file change is not automatically invalid.

It is a strong signal to split where practical.

## 31. Avoid artificial file-count reduction

Do not reduce file count by:

- weakening tests;
- hiding changes in generated files;
- using dynamic imports to avoid exports;
- moving unrelated work into another file;
- combining unrelated commits;
- deleting necessary documentation;
- omitting required consumer updates.

The objective is coherent scope, not a cosmetic number.

## 32. Commit scope

Each commit should represent a coherent step.

Example:

```text
test(poll): specify invalid duration behavior

feat(poll): reject non-positive duration
```

These may be separate commits if the workflow uses test-first commits.

Do not combine:

```text
feat(poll): add duration validation
+
refactor(crypto)
+
docs(core)
```

into one commit.

## 33. Conventional Commit selection

Choose the type based on primary intent:

```text
feat  → new behavior
fix   → bug correction
refactor → behavior-preserving structural change
test  → test-only change
docs  → documentation-only change
build → dependency/build system change
ci    → CI change
perf  → performance behavior
chore → maintenance
```

Do not mislabel a behavior change as `refactor`.

## 34. Final scope review

Before completion:

```text
git status
git diff --stat
git diff
```

Then answer:

```text
Why did every changed file change?

What behavior does each change support?

Is any change merely convenient?

Can anything be removed without making the task incomplete?
```

If a change can be removed while preserving the requested outcome, strongly consider removing it.

## 35. Scope review template

```text
Purpose:
<one sentence>

Required files:
- <file>: <why required>
- <file>: <why required>

Optional/discovered work excluded:
- <item>: <why separate>

Package impact:
<packages>

Public API impact:
<none / details>

20+ file review:
<not applicable / justification>

Decision:
<atomic / split>
```

## 36. Final checklist

```text
[ ] One primary purpose is clearly defined
[ ] Repository/package boundaries were inspected
[ ] Existing abstractions were searched
[ ] Every changed file is necessary
[ ] Every changed code section is relevant
[ ] Required tests are included
[ ] Existing test strength is preserved
[ ] Property tests are preserved
[ ] Public API changes are intentional
[ ] Dependencies changed only when required
[ ] Lockfile changes are intentional
[ ] Generated changes come from the source of truth
[ ] No unrelated formatting exists
[ ] No opportunistic cleanup exists
[ ] No speculative architecture exists
[ ] 20+ files triggered scope review
[ ] Independent concerns were split where practical
[ ] Conventional Commit is appropriate
[ ] Final diff has been reviewed
```

## 37. Completion criteria

The scope is ready for completion when:

```text
requested behavior
+
required tests
+
required supporting changes
+
required validation
```

are complete, and:

```text
no unrelated work
+
no unexplained diff
+
no unnecessary dependency changes
```

remain.

The correct end state is not the smallest possible diff.

It is the **smallest complete diff that fully satisfies the requested task**.
