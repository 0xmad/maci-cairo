/*
 * MACI stand-up graph: LeanIMT → FreeForAll Policy → vote-balance assigner →
 * declare Poll/PollFactory → deploy MACI → Enforcer `set_target` → check coordinator.
 *
 * Depth, vote balance, and empty ballot roots match `contracts/tests/maci.cairo`.
 */
import { DEVNET_SEED0_DEVNET_1, intendedCoordinator, normalizeHex } from "./hex.js";

/** `MACI` constructor `state_tree_depth`. */
export const STATE_TREE_DEPTH = 5;

/** `ConstantInitialVoteBalance` constructor amount. */
export const VOTE_BALANCE = 3;

/** Five empty-ballot Merkle roots for `state_tree_depth` 5. */
export const EMPTY_BALLOT_ROOTS = [
  "16015576667038038422103932363190100635991292382181099511410843174865570503661",
  "166510078825589460025300915201657086611944528317298994959376081297530246971",
  "10057734083972610459557695472359628128485394923403014377687504571662791937025",
  "4904828619307091008204672239231377290495002626534171783829482835985709082773",
  "18694062287284245784028624966421731916526814537891066525886866373016385890569",
] as const;

/** sncast operations used by {@link standUp}; tests inject a recorder. */
export interface SncastOps {
  declareClass: (contractName: string) => string;
  deployUnique: (classHash: string, argumentsExpr?: string) => string;
  field: (key: string, args: string[]) => string;
}

/** Addresses and class hashes printed after a successful stand-up. */
export interface StandUpResult {
  leanImt: string;
  checker: string;
  enforcer: string;
  assigner: string;
  pollClassHash: string;
  pollFactoryClassHash: string;
  maci: string;
  pollFactory: string;
  coordinator: string;
}

export interface StandUpOptions {
  /** Hex coordinator; empty or omitted uses seed-0 `devnet-1`. */
  coordinatorOverride?: string;
}

/** One `label: 0x…` line per {@link StandUpResult} field, for stdout. */
export function formatStandUp(result: StandUpResult): string {
  return [
    `lean_imt: ${result.leanImt}`,
    `checker: ${result.checker}`,
    `enforcer: ${result.enforcer}`,
    `assigner: ${result.assigner}`,
    `poll_class_hash: ${result.pollClassHash}`,
    `poll_factory_class_hash: ${result.pollFactoryClassHash}`,
    `maci: ${result.maci}`,
    `poll_factory: ${result.pollFactory}`,
    `coordinator: ${result.coordinator}`,
  ].join("\n");
}

/**
 * Declare and deploy the local MACI stack. Does not create a Poll.
 *
 * FreeForAllEnforcer is constructed with the checker and seed-0 `devnet-1` as
 * owner: UDC deploy would otherwise make the UDC the owner.
 *
 * @throws If on-chain `coordinator()` does not match the intended coordinator.
 */
export function standUp(ops: SncastOps, options: StandUpOptions = {}): StandUpResult {
  const coordinator = intendedCoordinator(options.coordinatorOverride);
  const deployer = normalizeHex(DEVNET_SEED0_DEVNET_1);

  const leanImtClass = ops.declareClass("LeanIMT");
  const leanImt = ops.deployUnique(leanImtClass);

  const checkerClass = ops.declareClass("FreeForAllChecker");
  const checker = ops.deployUnique(checkerClass);

  const enforcerClass = ops.declareClass("FreeForAllEnforcer");
  const enforcer = ops.deployUnique(enforcerClass, `${checker}, ${deployer}`);

  const assignerClass = ops.declareClass("ConstantInitialVoteBalance");
  const assigner = ops.deployUnique(assignerClass, String(VOTE_BALANCE));

  const pollClass = ops.declareClass("Poll");
  const pollFactoryClass = ops.declareClass("PollFactory");
  const maciClass = ops.declareClass("MACI");

  const maciArgs = `maci_contracts::MACI::ConstructorParams { state_tree_depth: ${STATE_TREE_DEPTH}, state_tree_address: ${leanImt}, empty_ballot_roots: (${EMPTY_BALLOT_ROOTS.join(", ")}), enforcer: ${enforcer}, vote_balance_assigner: ${assigner}, coordinator: ${coordinator}, poll_factory_class_hash: ${pollFactoryClass}, poll_class_hash: ${pollClass} }`;
  const maci = ops.deployUnique(maciClass, maciArgs);

  ops.field("transaction_hash", [
    "invoke",
    "--contract-address",
    enforcer,
    "--function",
    "set_target",
    "--arguments",
    maci,
  ]);

  const actualCoordinator = normalizeHex(
    ops.field("response", ["call", "--contract-address", maci, "--function", "coordinator"]),
  );

  if (actualCoordinator !== coordinator) {
    throw new Error(`coordinator mismatch: intended ${coordinator}, on-chain ${actualCoordinator}`);
  }

  const pollFactory = normalizeHex(
    ops.field("response", ["call", "--contract-address", maci, "--function", "get_poll_factory"]),
  );

  return {
    leanImt,
    checker,
    enforcer,
    assigner,
    pollClassHash: pollClass,
    pollFactoryClassHash: pollFactoryClass,
    maci,
    pollFactory,
    coordinator: actualCoordinator,
  };
}
