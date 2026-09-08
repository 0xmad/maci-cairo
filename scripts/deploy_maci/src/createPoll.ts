/*
 * Coordinator `create_poll` against an already-stood-up MACI.
 *
 * Intent is a strict JSON file. MACI assigns poll id; stdout is the record.
 */
import { NEVER, number, strictObject, string, tuple, union, type infer as ZodInfer, type ZodError } from "zod";

import { DEVNET_SEED0_DEVNET_1, normalizeHex } from "./hex.js";

/** sncast `call` / `invoke` used by {@link createPoll}; tests inject a recorder. */
export interface CreatePollOps {
  field: (key: string, args: string[]) => string;
}

/** Addresses and poll id printed after a successful create. */
export interface CreatePollResult {
  maci: string;
  poll: string;
  pollId: string;
}

const uintJson = union([
  number().refine((value) => Number.isSafeInteger(value) && value >= 0, { error: "invalid integer" }),
  string()
    .trim()
    .regex(/^(?:0x[0-9a-fA-F]+|[0-9]+)$/u, { error: "invalid integer" }),
]).transform((value): bigint => (typeof value === "number" ? BigInt(value) : BigInt(value)));

const maciSchema = string().transform((value, ctx) => {
  try {
    return normalizeHex(value);
  } catch {
    ctx.addIssue({
      code: "custom",
      message: `invalid hex: ${value}`,
    });

    return NEVER;
  }
});

const createPollConfigSchema = strictObject({
  maci: maciSchema,
  start_date: uintJson,
  end_date: uintJson,
  poll_public_key: tuple([uintJson, uintJson]),
  state_tree_depth: uintJson,
  vote_options: uintJson,
  batch_size: uintJson,
  empty_live_ballot_root: uintJson,
}).transform((row) => ({
  maci: row.maci,
  startDate: row.start_date,
  endDate: row.end_date,
  pollPublicKey: row.poll_public_key,
  stateTreeDepth: row.state_tree_depth,
  voteOptions: row.vote_options,
  batchSize: row.batch_size,
  emptyLiveBallotRoot: row.empty_live_ballot_root,
}));

/** Parsed `CreatePollArgs` plus MACI address. */
export type CreatePollConfig = ZodInfer<typeof createPollConfigSchema>;

function issueLooksMissing(issue: ZodError["issues"][number]): boolean {
  if (issue.message.includes("undefined")) {
    return true;
  }

  if (issue.code !== "invalid_union") {
    return false;
  }

  return issue.errors.some((branch) => branch.some((inner) => inner.message.includes("undefined")));
}

function formatCreatePollConfigError(error: ZodError): string {
  const [issue] = error.issues;

  if (issue.code === "unrecognized_keys") {
    return `unknown key ${issue.keys.join(", ")}`;
  }

  if (issue.code === "custom") {
    return issue.message;
  }

  if (issue.path.length === 1 && issueLooksMissing(issue)) {
    return `missing key ${String(issue.path[0])}`;
  }

  if (issue.code === "invalid_type" && issue.path.length === 0) {
    return "create-poll config must be a JSON object";
  }

  return issue.message;
}

/**
 * Parse a felt/hex or decimal sncast `response` as a non-negative integer.
 */
function integerFromFelt(value: string): bigint {
  const trimmed = value.trim();

  if (/^0x[0-9a-fA-F]+$/u.test(trimmed)) {
    return BigInt(trimmed);
  }

  if (/^[0-9]+$/u.test(trimmed)) {
    return BigInt(trimmed);
  }

  throw new Error(`invalid integer: ${value}`);
}

const CREATE_POLL_USAGE = "usage: create-poll --config <path>";

/**
 * Read the JSON intent path from CLI tokens (`--config <path>` or `--config=<path>`).
 *
 * @throws If `--config` is missing, empty, or followed by extra tokens.
 */
export function parseCreatePollArgv(args: readonly string[]): string {
  const tokens = args[0] === "--" ? args.slice(1) : args;
  const flag = tokens[0] ?? "";

  if (flag === "--config") {
    const pathValue = tokens[1];

    if (tokens.length !== 2 || pathValue.length === 0) {
      throw new Error(CREATE_POLL_USAGE);
    }

    return pathValue;
  }

  if (flag.startsWith("--config=")) {
    const configValue = flag.slice("--config=".length);

    if (configValue.length === 0 || tokens.length !== 1) {
      throw new Error(CREATE_POLL_USAGE);
    }

    return configValue;
  }

  throw new Error(CREATE_POLL_USAGE);
}

/**
 * Parse Coordinator create-poll intent JSON. Exactly the required keys; no `poll_id`.
 *
 * @throws If JSON is invalid, keys are wrong, or a field is not a non-negative integer / hex address.
 */
export function parseCreatePollConfig(text: string): CreatePollConfig {
  const parsed: unknown = JSON.parse(text) as unknown;
  const result = createPollConfigSchema.safeParse(parsed);

  if (!result.success) {
    throw new Error(formatCreatePollConfigError(result.error));
  }

  return result.data;
}

/** Cairo `--arguments` expression for `CreatePollArgs`. */
function createPollArgumentsExpr(config: CreatePollConfig): string {
  const [keyX, keyY] = config.pollPublicKey;

  return `maci_contracts::PollFactory::CreatePollArgs { start_date: ${config.startDate}, end_date: ${config.endDate}, poll_public_key: (${keyX}, ${keyY}), state_tree_depth: ${config.stateTreeDepth}, vote_options: ${config.voteOptions}, batch_size: ${config.batchSize}, empty_live_ballot_root: ${config.emptyLiveBallotRoot} }`;
}

/** One `label: …` line per {@link CreatePollResult} field, for stdout. */
export function formatCreatePoll(result: CreatePollResult): string {
  return [`maci: ${result.maci}`, `poll: ${result.poll}`, `poll_id: ${result.pollId}`].join("\n");
}

/**
 * Create a Poll as seed-0 `devnet-1`. Does not stand up MACI.
 *
 * @throws If on-chain `coordinator()` is not `devnet-1`, `state_tree_depth` does not match the config, or `get_poll` is still zero after `create_poll`.
 */
export function createPoll(ops: CreatePollOps, config: CreatePollConfig): CreatePollResult {
  const intended = normalizeHex(DEVNET_SEED0_DEVNET_1);
  const actualCoordinator = normalizeHex(
    ops.field("response", ["call", "--contract-address", config.maci, "--function", "coordinator"]),
  );

  if (actualCoordinator !== intended) {
    throw new Error(`coordinator mismatch: intended ${intended}, on-chain ${actualCoordinator}`);
  }

  const actualDepth = integerFromFelt(
    ops.field("response", ["call", "--contract-address", config.maci, "--function", "state_tree_depth"]),
  );

  if (actualDepth !== config.stateTreeDepth) {
    throw new Error(`state_tree_depth mismatch: config ${config.stateTreeDepth}, on-chain ${actualDepth}`);
  }

  const zero = normalizeHex("0x0");
  const nextPollId = integerFromFelt(
    ops.field("response", ["call", "--contract-address", config.maci, "--function", "next_poll_id"]),
  );

  ops.field("transaction_hash", [
    "invoke",
    "--contract-address",
    config.maci,
    "--function",
    "create_poll",
    "--arguments",
    createPollArgumentsExpr(config),
  ]);

  const poll = normalizeHex(
    ops.field("response", [
      "call",
      "--contract-address",
      config.maci,
      "--function",
      "get_poll",
      "--arguments",
      nextPollId.toString(),
    ]),
  );

  if (poll === zero) {
    throw new Error(`create_poll did not record a Poll at id ${nextPollId}`);
  }

  const pollId = integerFromFelt(
    ops.field("response", ["call", "--contract-address", poll, "--function", "poll_id"]),
  ).toString();

  return { maci: config.maci, poll, pollId };
}
