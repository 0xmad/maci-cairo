/*
 * MACI deploy graph: LeanIMT → FreeForAll Policy → vote-balance assigner →
 * declare Poll/PollFactory → deploy MACI → Enforcer `set_target` → check coordinator.
 *
 * Circuit profile `small`, Policy, and assigner are explicit stand-up intent.
 */
import { EMPTY_BALLOT_ROOTS } from "./config.js";
import { DEVNET_SEED0_DEVNET_1, intendedCoordinator, normalizeHex } from "./hex.js";
import { resolveStandupIntent, type DeployMaciIntent } from "./intent.js";

/** sncast operations used by {@link deployMaci}; tests inject a recorder. */
export interface SncastOps {
  declareClass: (contractName: string) => string;
  deployUnique: (classHash: string, argumentsExpr?: string) => string;
  field: (key: string, args: string[]) => string;
}

/** Starknet network this MACI was stood up on. */
export type MaciNetwork = "starknet_local" | "sepolia";

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
  deployer: string;
  network: MaciNetwork;
}

export interface DeployMaciOptions {
  /** Hex coordinator; empty or omitted uses seed-0 `devnet-1`. */
  coordinatorOverride?: string;
  /** Defaults to `local` (sncast `devnet` profile). */
  network?: MaciNetwork;
  /**
   * Partial stand-up already on-chain. Matching `deployUnique` and declare
   * steps are skipped; a missing class hash is declared again.
   */
  checkpoint?: DeployMaciCheckpoint;
  /** Optional reporter for each sncast step. Awaited before the next step. */
  onStep?: (step: DeployMaciStep) => void | Promise<void>;
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

type DeployMaciInstanceName = Extract<DeployMaciStep, { kind: "deploy" }>["name"];

interface DeclareOrReuseArgs {
  ops: SncastOps;
  existing: string | undefined;
  contractName: DeployMaciDeclareName;
  onStep: DeployMaciOptions["onStep"];
}

interface DeployOrReuseArgs {
  ops: SncastOps;
  existing: string | undefined;
  classHash: string;
  argumentsExpr: string | undefined;
  onStep: DeployMaciOptions["onStep"];
  name: DeployMaciInstanceName;
}

function hasValue(value: string | undefined): value is string {
  return value !== undefined && value.length > 0;
}

async function declareOrReuse(args: DeclareOrReuseArgs): Promise<string> {
  if (hasValue(args.existing)) {
    return args.existing;
  }

  const classHash = args.ops.declareClass(args.contractName);
  await args.onStep?.({ kind: "declare", name: args.contractName });

  return classHash;
}

async function deployOrReuse(args: DeployOrReuseArgs): Promise<string> {
  if (hasValue(args.existing)) {
    return args.existing;
  }

  const address = args.ops.deployUnique(args.classHash, args.argumentsExpr);
  await args.onStep?.({ kind: "deploy", name: args.name });

  return address;
}

/** Labeled stdout record for a successful MACI deploy. */
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
    `deployer: ${result.deployer}`,
    `network: ${result.network}`,
  ].join("\n");
}

/**
 * Declare and deploy the local MACI stack. Does not create a Poll.
 *
 * FreeForAllEnforcer is constructed with the checker and seed-0 `devnet-1` as
 * owner: UDC deploy would otherwise make the UDC the owner.
 *
 * @throws If on-chain `coordinator()` does not match the intended coordinator,
 *   the Circuit profile, Policy, or assigner name is unknown, or the constant
 *   assigner amount is 0 or at least `2^251`.
 */
export async function deployMaci(
  ops: SncastOps,
  intent: DeployMaciIntent,
  options: DeployMaciOptions = {},
): Promise<DeployMaciResult> {
  const resolved = resolveStandupIntent(intent);
  const { onStep, checkpoint = {}, coordinatorOverride, network = "starknet_local" } = options;
  const coordinator = intendedCoordinator(coordinatorOverride);
  const deployer = normalizeHex(DEVNET_SEED0_DEVNET_1);

  const leanImtClass = await declareOrReuse({ ops, existing: undefined, contractName: "LeanIMT", onStep });
  const leanImt = await deployOrReuse({
    ops,
    existing: checkpoint.leanImt,
    classHash: leanImtClass,
    argumentsExpr: undefined,
    onStep,
    name: "leanImt",
  });

  const checkerClass = await declareOrReuse({ ops, existing: undefined, contractName: "FreeForAllChecker", onStep });
  const checker = await deployOrReuse({
    ops,
    existing: checkpoint.checker,
    classHash: checkerClass,
    argumentsExpr: undefined,
    onStep,
    name: "checker",
  });

  const enforcerClass = await declareOrReuse({ ops, existing: undefined, contractName: "FreeForAllEnforcer", onStep });
  const enforcer = await deployOrReuse({
    ops,
    existing: checkpoint.enforcer,
    classHash: enforcerClass,
    argumentsExpr: `${checker}, ${deployer}`,
    onStep,
    name: "enforcer",
  });

  const assignerClass = await declareOrReuse({
    ops,
    existing: undefined,
    contractName: "ConstantInitialVoteBalance",
    onStep,
  });
  const assigner = await deployOrReuse({
    ops,
    existing: checkpoint.assigner,
    classHash: assignerClass,
    argumentsExpr: resolved.constantVoteBalance.toString(),
    onStep,
    name: "assigner",
  });

  const pollClass = await declareOrReuse({ ops, existing: checkpoint.pollClassHash, contractName: "Poll", onStep });
  const pollFactoryClass = await declareOrReuse({
    ops,
    existing: checkpoint.pollFactoryClassHash,
    contractName: "PollFactory",
    onStep,
  });
  const maciClass = await declareOrReuse({ ops, existing: checkpoint.maciClassHash, contractName: "MACI", onStep });

  const maciArgs = `maci_contracts::MACI::ConstructorParams { state_tree_depth: ${resolved.stateTreeDepth}, vote_options: ${resolved.voteOptions}, batch_size: ${resolved.batchSize}, empty_live_ballot_root: ${resolved.emptyLiveBallotRoot}, state_tree_address: ${leanImt}, empty_ballot_roots: (${EMPTY_BALLOT_ROOTS.join(", ")}), enforcer: ${enforcer}, vote_balance_assigner: ${assigner}, coordinator: ${coordinator}, poll_factory_class_hash: ${pollFactoryClass}, poll_class_hash: ${pollClass} }`;
  const maci = await deployOrReuse({
    ops,
    existing: checkpoint.maci,
    classHash: maciClass,
    argumentsExpr: maciArgs,
    onStep,
    name: "maci",
  });

  ops.field("transaction_hash", [
    "invoke",
    "--contract-address",
    enforcer,
    "--function",
    "set_target",
    "--arguments",
    maci,
  ]);
  await onStep?.({ kind: "invoke", name: "set_target" });

  const actualCoordinator = normalizeHex(
    ops.field("response", ["call", "--contract-address", maci, "--function", "coordinator"]),
  );
  await onStep?.({ kind: "call", name: "coordinator" });

  if (actualCoordinator !== coordinator) {
    throw new Error(`coordinator mismatch: intended ${coordinator}, on-chain ${actualCoordinator}`);
  }

  const pollFactory = normalizeHex(
    ops.field("response", ["call", "--contract-address", maci, "--function", "get_poll_factory"]),
  );
  await onStep?.({ kind: "call", name: "get_poll_factory" });

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
    deployer,
    network,
  };
}
