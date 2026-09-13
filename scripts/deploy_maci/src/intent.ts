import {
  ASSIGNER_CONSTANT_VOTE_BALANCE,
  BATCH_SIZE,
  CIRCUIT_PROFILE_SMALL,
  EMPTY_LIVE_BALLOT_ROOT,
  POLICY_FREE_FOR_ALL,
  STATE_TREE_DEPTH,
  VOTE_BALANCE,
  VOTE_OPTIONS,
} from "./config.js";

/** Operator stand-up intent: Circuit profile, Policy, and vote-balance assigner. */
export interface DeployMaciIntent {
  circuitProfile: string;
  policy: string;
  assigner: string;
  /** Constant assigner amount. Defaults to 3. */
  constantVoteBalance?: bigint;
}

/** Explicit `small` / Free for all / constant stand-up intent. */
export const SMALL_STANDUP_INTENT: DeployMaciIntent = {
  circuitProfile: CIRCUIT_PROFILE_SMALL,
  policy: POLICY_FREE_FOR_ALL,
  assigner: ASSIGNER_CONSTANT_VOTE_BALANCE,
};

const MAX_CONSTANT_VOTE_BALANCE = 2n ** 251n;

export interface ResolvedStandupIntent {
  stateTreeDepth: number;
  voteOptions: number;
  batchSize: number;
  emptyLiveBallotRoot: string;
  constantVoteBalance: bigint;
}

export function resolveStandupIntent(intent: DeployMaciIntent): ResolvedStandupIntent {
  if (intent.circuitProfile !== CIRCUIT_PROFILE_SMALL) {
    throw new Error(`unknown circuit profile: ${intent.circuitProfile}`);
  }

  if (intent.policy !== POLICY_FREE_FOR_ALL) {
    throw new Error(`unknown policy: ${intent.policy}`);
  }

  if (intent.assigner !== ASSIGNER_CONSTANT_VOTE_BALANCE) {
    throw new Error(`unknown assigner: ${intent.assigner}`);
  }

  const constantVoteBalance = intent.constantVoteBalance ?? BigInt(VOTE_BALANCE);

  if (constantVoteBalance === 0n) {
    throw new Error("Zero vote balance");
  }

  if (constantVoteBalance >= MAX_CONSTANT_VOTE_BALANCE) {
    throw new Error("Vote balance too large");
  }

  return {
    stateTreeDepth: STATE_TREE_DEPTH,
    voteOptions: VOTE_OPTIONS,
    batchSize: BATCH_SIZE,
    emptyLiveBallotRoot: EMPTY_LIVE_BALLOT_ROOT,
    constantVoteBalance,
  };
}
