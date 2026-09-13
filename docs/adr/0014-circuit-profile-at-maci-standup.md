# Circuit profile, Policy, and assigner are chosen at MACI stand-up

An Operator stands up a MACI by picking a Circuit profile, a Policy, and a
vote-balance assigner. The profile binds one compiled Ballot / TallyBatch /
TallyFinalize trio to that MACI. MACI writes `state_tree_depth`,
`vote_options`, `batch_size`, and a computed `empty_live_ballot_root` onto
every Poll. The Coordinator supplies only schedule and poll public key. The
Operator sees Policy and assigner names, not Checker or Enforcer. A constant
assigner still takes a number (default 3). Candidate labels are off-chain;
unused vote-option slots still count.

We rejected per-Poll circuit params, a Poll `state_tree_depth` less than the
MACI’s, Operator-typed raw depths, and an on-chain active-option count.

Only profile `small` exists now: Ballot `[5, 5]`, TallyBatch `[4, 5, 4]`,
TallyFinalize `[5]`. Live-ballot tree capacity is 16 user commitments while
Max Signups is 32 leaves; that mismatch stays until later profiles. This
reopens ADR-0010’s hardcoded FreeForAll-only stand-up, as Operator-facing
knobs, not as new Policy implementations.
