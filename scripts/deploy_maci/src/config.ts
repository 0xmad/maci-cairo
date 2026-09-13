/** Operator-facing Circuit profile name. Only `small` exists. */
export const CIRCUIT_PROFILE_SMALL = "small";

/** Operator-facing Policy name. Only Free for all exists. */
export const POLICY_FREE_FOR_ALL = "Free for all";

/** Operator-facing vote-balance assigner name. Only constant exists. */
export const ASSIGNER_CONSTANT_VOTE_BALANCE = "Constant vote balance";

/** `small` Circuit profile `state_tree_depth`. */
export const STATE_TREE_DEPTH = 5;

/** `small` Circuit profile max vote options. */
export const VOTE_OPTIONS = 5;

/** `small` Circuit profile tally batch size. */
export const BATCH_SIZE = 4;

/** `small` Circuit profile live-ballot tree depth. Capacity is 16. */
export const LIVE_TREE_DEPTH = 4;

/** Default constant assigner amount. */
export const VOTE_BALANCE = 3;

/** Empty live-ballot root for live-tree depth 4 (sentinel at index 0). */
export const EMPTY_LIVE_BALLOT_ROOT = "13014191666213395169542407912453925109537961341471919263423658514128524472753";

/** Five empty-ballot Merkle roots for `state_tree_depth` 5. */
export const EMPTY_BALLOT_ROOTS = [
  "16015576667038038422103932363190100635991292382181099511410843174865570503661",
  "166510078825589460025300915201657086611944528317298994959376081297530246971",
  "10057734083972610459557695472359628128485394923403014377687504571662791937025",
  "4904828619307091008204672239231377290495002626534171783829482835985709082773",
  "18694062287284245784028624966421731916526814537891066525886866373016385890569",
] as const;
