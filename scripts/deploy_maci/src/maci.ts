/*
 * MACI deploy graph: LeanIMT → FreeForAll Policy → vote-balance assigner →
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

/** sncast operations used by {@link deployMaci}; tests inject a recorder. */
export interface SncastOps {
  declareClass: (contractName: string) => string;
  deployUnique: (classHash: string, argumentsExpr?: string) => string;
  field: (key: string, args: string[]) => string;
}

/** Addresses and class hashes printed after a successful MACI deploy. */
export interface DeployMaciResult {
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

export interface DeployMaciOptions {
  /** Hex coordinator; empty or omitted uses seed-0 `devnet-1`. */
  coordinatorOverride?: string;
  /**
   * Partial stand-up already on-chain. Matching `deployUnique` and declare
   * steps are skipped; a missing class hash is declared again.
   */
  checkpoint?: DeployMaciCheckpoint;
  /** Optional reporter for each sncast step. */
  onStep?: (step: DeployMaciStep) => void;
}

/** Instance addresses and class hashes that may already exist from a partial MACI stand-up. */
export interface DeployMaciCheckpoint {
  leanImt?: string;
  checker?: string;
  enforcer?: string;
  assigner?: string;
  maci?: string;
  pollClassHash?: string;
  pollFactoryClassHash?: string;
  maciClassHash?: string;
}

/** Contract name for a MACI stand-up declare step. */
export type DeployMaciDeclareName =
  | "LeanIMT"
  | "FreeForAllChecker"
  | "FreeForAllEnforcer"
  | "ConstantInitialVoteBalance"
  | "Poll"
  | "PollFactory"
  | "MACI";

/** One sncast step during MACI stand-up. */
export type DeployMaciStep =
  | { kind: "declare"; name: DeployMaciDeclareName }
  | { kind: "deploy"; name: "leanImt" | "checker" | "enforcer" | "assigner" | "maci" }
  | { kind: "invoke"; name: "set_target" }
  | { kind: "call"; name: "coordinator" | "get_poll_factory" };

function hasValue(value: string | undefined): value is string {
  return value !== undefined && value.length > 0;
}

function declareOrReuse(
  ops: SncastOps,
  existing: string | undefined,
  contractName: DeployMaciDeclareName,
  onStep: DeployMaciOptions["onStep"],
): string {
  if (hasValue(existing)) {
    return existing;
  }

  const classHash = ops.declareClass(contractName);
  onStep?.({ kind: "declare", name: contractName });

  return classHash;
}

function deployOrReuse(
  ops: SncastOps,
  existing: string | undefined,
  classHash: string,
  argumentsExpr: string | undefined,
  onStep: DeployMaciOptions["onStep"],
  name: "leanImt" | "checker" | "enforcer" | "assigner" | "maci",
): string {
  if (hasValue(existing)) {
    return existing;
  }

  const address = ops.deployUnique(classHash, argumentsExpr);
  onStep?.({ kind: "deploy", name });

  return address;
}

/** One `label: 0x…` line per {@link DeployMaciResult} field, for stdout. */
export function formatDeployMaci(result: DeployMaciResult): string {
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
export function deployMaci(ops: SncastOps, options: DeployMaciOptions = {}): DeployMaciResult {
  const { onStep, checkpoint = {}, coordinatorOverride } = options;
  const coordinator = intendedCoordinator(coordinatorOverride);
  const deployer = normalizeHex(DEVNET_SEED0_DEVNET_1);

  const leanImtClass = declareOrReuse(ops, undefined, "LeanIMT", onStep);
  const leanImt = deployOrReuse(ops, checkpoint.leanImt, leanImtClass, undefined, onStep, "leanImt");

  const checkerClass = declareOrReuse(ops, undefined, "FreeForAllChecker", onStep);
  const checker = deployOrReuse(ops, checkpoint.checker, checkerClass, undefined, onStep, "checker");

  const enforcerClass = declareOrReuse(ops, undefined, "FreeForAllEnforcer", onStep);
  const enforcer = deployOrReuse(
    ops,
    checkpoint.enforcer,
    enforcerClass,
    `${checker}, ${deployer}`,
    onStep,
    "enforcer",
  );

  const assignerClass = declareOrReuse(ops, undefined, "ConstantInitialVoteBalance", onStep);
  const assigner = deployOrReuse(ops, checkpoint.assigner, assignerClass, String(VOTE_BALANCE), onStep, "assigner");

  const pollClass = declareOrReuse(ops, checkpoint.pollClassHash, "Poll", onStep);
  const pollFactoryClass = declareOrReuse(ops, checkpoint.pollFactoryClassHash, "PollFactory", onStep);
  const maciClass = declareOrReuse(ops, checkpoint.maciClassHash, "MACI", onStep);

  const maciArgs = `maci_contracts::MACI::ConstructorParams { state_tree_depth: ${STATE_TREE_DEPTH}, state_tree_address: ${leanImt}, empty_ballot_roots: (${EMPTY_BALLOT_ROOTS.join(", ")}), enforcer: ${enforcer}, vote_balance_assigner: ${assigner}, coordinator: ${coordinator}, poll_factory_class_hash: ${pollFactoryClass}, poll_class_hash: ${pollClass} }`;
  const maci = deployOrReuse(ops, checkpoint.maci, maciClass, maciArgs, onStep, "maci");

  ops.field("transaction_hash", [
    "invoke",
    "--contract-address",
    enforcer,
    "--function",
    "set_target",
    "--arguments",
    maci,
  ]);
  onStep?.({ kind: "invoke", name: "set_target" });

  const actualCoordinator = normalizeHex(
    ops.field("response", ["call", "--contract-address", maci, "--function", "coordinator"]),
  );
  onStep?.({ kind: "call", name: "coordinator" });

  if (actualCoordinator !== coordinator) {
    throw new Error(`coordinator mismatch: intended ${coordinator}, on-chain ${actualCoordinator}`);
  }

  const pollFactory = normalizeHex(
    ops.field("response", ["call", "--contract-address", maci, "--function", "get_poll_factory"]),
  );
  onStep?.({ kind: "call", name: "get_poll_factory" });

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
