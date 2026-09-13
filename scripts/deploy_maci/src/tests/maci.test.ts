import { describe, expect, test } from "vitest";

import {
  BATCH_SIZE,
  EMPTY_BALLOT_ROOTS,
  EMPTY_LIVE_BALLOT_ROOT,
  LIVE_TREE_DEPTH,
  STATE_TREE_DEPTH,
  VOTE_BALANCE,
  VOTE_OPTIONS,
} from "../config.js";
import { DEVNET_SEED0_DEVNET_1, intendedCoordinator, normalizeHex } from "../hex.js";
import { SMALL_STANDUP_INTENT } from "../intent.js";
import { deployMaci, formatDeployMaci, type DeployMaciResult, type DeployMaciStep, type SncastOps } from "../maci.js";

function padIndex(index: number): string {
  return normalizeHex(`0x${index.toString(16)}`);
}

function recordingOps(options: { coordinatorOnChain?: string } = {}): SncastOps & {
  declares: string[];
  deploys: { classHash: string; argumentsExpr?: string }[];
  fields: { key: string; args: string[] }[];
} {
  let next = 1;
  const declares: string[] = [];
  const deploys: { classHash: string; argumentsExpr?: string }[] = [];
  const fields: { key: string; args: string[] }[] = [];

  const ops: SncastOps & {
    declares: string[];
    deploys: { classHash: string; argumentsExpr?: string }[];
    fields: { key: string; args: string[] }[];
  } = {
    declares,
    deploys,
    fields,
    declareClass(contractName: string): string {
      declares.push(contractName);
      const classHash = padIndex(next);
      next += 1;
      return classHash;
    },
    deployUnique(classHash: string, argumentsExpr?: string): string {
      deploys.push({ classHash, argumentsExpr });
      const address = padIndex(next);
      next += 1;
      return address;
    },
    field(key: string, args: string[]): string {
      fields.push({ key, args });
      if (args[0] === "call" && args.includes("coordinator")) {
        return options.coordinatorOnChain ?? intendedCoordinator(undefined);
      }
      if (args[0] === "call" && args.includes("get_poll_factory")) {
        return padIndex(0xff);
      }
      return padIndex(next);
    },
  };

  return ops;
}

describe("deployMaci", () => {
  test("declares and deploys in MACI deploy order", async () => {
    const ops = recordingOps();
    const result = await deployMaci(ops, SMALL_STANDUP_INTENT);

    expect(ops.declares).toEqual([
      "LeanIMT",
      "FreeForAllChecker",
      "FreeForAllEnforcer",
      "ConstantInitialVoteBalance",
      "Poll",
      "PollFactory",
      "MACI",
    ]);

    expect(ops.deploys).toHaveLength(5);
    expect(ops.deploys[0]?.argumentsExpr).toBeUndefined();
    expect(ops.deploys[1]?.argumentsExpr).toBeUndefined();
    expect(ops.deploys[2]?.argumentsExpr).toBe(`${result.checker}, ${normalizeHex(DEVNET_SEED0_DEVNET_1)}`);
    expect(ops.deploys[3]?.argumentsExpr).toBe(String(VOTE_BALANCE));

    const maciArgs = ops.deploys[4]?.argumentsExpr ?? "";
    expect(maciArgs).toContain(`state_tree_depth: ${STATE_TREE_DEPTH}`);
    expect(maciArgs).toContain(`vote_options: ${VOTE_OPTIONS}`);
    expect(maciArgs).toContain(`batch_size: ${BATCH_SIZE}`);
    expect(maciArgs).toContain(`empty_live_ballot_root: ${EMPTY_LIVE_BALLOT_ROOT}`);
    expect(maciArgs).toContain(`state_tree_address: ${result.leanImt}`);
    expect(maciArgs).toContain(`empty_ballot_roots: (${EMPTY_BALLOT_ROOTS.join(", ")})`);
    expect(maciArgs).toContain(`enforcer: ${result.enforcer}`);
    expect(maciArgs).toContain(`vote_balance_assigner: ${result.assigner}`);
    expect(maciArgs).toContain(`coordinator: ${result.coordinator}`);
    expect(maciArgs).toContain(`poll_factory_class_hash: ${result.pollFactoryClassHash}`);
    expect(maciArgs).toContain(`poll_class_hash: ${result.pollClassHash}`);

    expect(ops.fields[0]).toEqual({
      key: "transaction_hash",
      args: ["invoke", "--contract-address", result.enforcer, "--function", "set_target", "--arguments", result.maci],
    });
    expect(ops.fields[1]?.args).toEqual(["call", "--contract-address", result.maci, "--function", "coordinator"]);
    expect(ops.fields[2]?.args).toEqual(["call", "--contract-address", result.maci, "--function", "get_poll_factory"]);
    expect(result.network).toBe("starknet_local");
    expect(result.deployer).toBe(normalizeHex(DEVNET_SEED0_DEVNET_1));
  });

  test("leaves live-tree capacity 16 against Max Signups 32", () => {
    expect(2 ** LIVE_TREE_DEPTH).toBe(16);
    expect(2 ** STATE_TREE_DEPTH).toBe(32);
  });

  test("rejects an unknown Circuit profile before declaring", async () => {
    const ops = recordingOps();

    await expect(deployMaci(ops, { ...SMALL_STANDUP_INTENT, circuitProfile: "medium" })).rejects.toThrow(
      /unknown circuit profile: medium/u,
    );
    expect(ops.declares).toEqual([]);
  });

  test("rejects an unknown Policy before declaring", async () => {
    const ops = recordingOps();

    await expect(deployMaci(ops, { ...SMALL_STANDUP_INTENT, policy: "Allowlist" })).rejects.toThrow(
      /unknown policy: Allowlist/u,
    );
    expect(ops.declares).toEqual([]);
  });

  test("rejects an unknown assigner before declaring", async () => {
    const ops = recordingOps();

    await expect(deployMaci(ops, { ...SMALL_STANDUP_INTENT, assigner: "Token gate" })).rejects.toThrow(
      /unknown assigner: Token gate/u,
    );
    expect(ops.declares).toEqual([]);
  });

  test("rejects a zero constant assigner amount before declaring", async () => {
    const ops = recordingOps();

    await expect(deployMaci(ops, { ...SMALL_STANDUP_INTENT, constantVoteBalance: 0n })).rejects.toThrow(
      /Zero vote balance/u,
    );
    expect(ops.declares).toEqual([]);
  });

  test("rejects a constant assigner amount at 2^251 before declaring", async () => {
    const ops = recordingOps();

    await expect(deployMaci(ops, { ...SMALL_STANDUP_INTENT, constantVoteBalance: 2n ** 251n })).rejects.toThrow(
      /Vote balance too large/u,
    );
    expect(ops.declares).toEqual([]);
  });

  test("deploys the constant assigner with an explicit amount", async () => {
    const ops = recordingOps();

    await deployMaci(ops, { ...SMALL_STANDUP_INTENT, constantVoteBalance: 7n });

    expect(ops.deploys[3]?.argumentsExpr).toBe("7");
  });

  test("uses COORDINATOR_OVERRIDE in MACI constructor calldata", async () => {
    const ops = recordingOps({
      coordinatorOnChain: intendedCoordinator("0x1"),
    });
    const result = await deployMaci(ops, SMALL_STANDUP_INTENT, { coordinatorOverride: "0x1" });

    expect(ops.deploys[4]?.argumentsExpr).toContain(`coordinator: ${intendedCoordinator("0x1")}`);
    expect(result.coordinator).toBe(intendedCoordinator("0x1"));
  });

  test("reports each declare, deploy, invoke, and check when onStep is set", async () => {
    const ops = recordingOps();
    const steps: DeployMaciStep[] = [];

    await deployMaci(ops, SMALL_STANDUP_INTENT, {
      onStep: (step) => {
        steps.push(step);
      },
    });

    expect(steps).toEqual([
      { kind: "declare", name: "LeanIMT" },
      { kind: "deploy", name: "leanImt" },
      { kind: "declare", name: "FreeForAllChecker" },
      { kind: "deploy", name: "checker" },
      { kind: "declare", name: "FreeForAllEnforcer" },
      { kind: "deploy", name: "enforcer" },
      { kind: "declare", name: "ConstantInitialVoteBalance" },
      { kind: "deploy", name: "assigner" },
      { kind: "declare", name: "Poll" },
      { kind: "declare", name: "PollFactory" },
      { kind: "declare", name: "MACI" },
      { kind: "deploy", name: "maci" },
      { kind: "invoke", name: "set_target" },
      { kind: "call", name: "coordinator" },
      { kind: "call", name: "get_poll_factory" },
    ]);
  });

  test("skips deployUnique for checkpointed instance addresses and still declares", async () => {
    const ops = recordingOps();
    const checkpoint = {
      leanImt: "0xaaa",
      checker: "0xbbb",
      enforcer: "0xccc",
      assigner: "0xddd",
      maci: "0xeee",
    };

    const result = await deployMaci(ops, SMALL_STANDUP_INTENT, { checkpoint });

    expect(ops.declares).toEqual([
      "LeanIMT",
      "FreeForAllChecker",
      "FreeForAllEnforcer",
      "ConstantInitialVoteBalance",
      "Poll",
      "PollFactory",
      "MACI",
    ]);
    expect(ops.deploys).toEqual([]);
    expect(result.leanImt).toBe("0xaaa");
    expect(result.checker).toBe("0xbbb");
    expect(result.enforcer).toBe("0xccc");
    expect(result.assigner).toBe("0xddd");
    expect(result.maci).toBe("0xeee");
    expect(ops.fields[0]?.args).toEqual([
      "invoke",
      "--contract-address",
      "0xccc",
      "--function",
      "set_target",
      "--arguments",
      "0xeee",
    ]);
  });

  test("redeploys instances that are not in the checkpoint", async () => {
    const ops = recordingOps();
    const result = await deployMaci(ops, SMALL_STANDUP_INTENT, { checkpoint: { leanImt: "0xaaa" } });

    expect(ops.deploys).toHaveLength(4);
    expect(result.leanImt).toBe("0xaaa");
    expect(result.checker).not.toBe("0xaaa");
  });

  test("skips declare when the checkpoint already has that class hash", async () => {
    const ops = recordingOps();
    const result = await deployMaci(ops, SMALL_STANDUP_INTENT, {
      checkpoint: {
        pollClassHash: "0x5",
        pollFactoryClassHash: "0x6",
        maciClassHash: "0x7",
      },
    });

    expect(ops.declares).toEqual(["LeanIMT", "FreeForAllChecker", "FreeForAllEnforcer", "ConstantInitialVoteBalance"]);
    expect(result.pollClassHash).toBe("0x5");
    expect(result.pollFactoryClassHash).toBe("0x6");
    expect(ops.deploys[4]?.argumentsExpr).toContain("poll_class_hash: 0x5");
    expect(ops.deploys[4]?.argumentsExpr).toContain("poll_factory_class_hash: 0x6");
  });

  test("does not report skipped declare or deploy steps", async () => {
    const ops = recordingOps();
    const steps: DeployMaciStep[] = [];

    await deployMaci(ops, SMALL_STANDUP_INTENT, {
      checkpoint: {
        leanImt: "0xaaa",
        checker: "0xbbb",
        enforcer: "0xccc",
        assigner: "0xddd",
        maci: "0xeee",
        pollClassHash: "0x5",
        pollFactoryClassHash: "0x6",
        maciClassHash: "0x7",
      },
      onStep: (step) => {
        steps.push(step);
      },
    });

    expect(steps.filter((step) => step.kind === "deploy")).toEqual([]);
    expect(steps.filter((step) => step.kind === "declare")).toEqual([
      { kind: "declare", name: "LeanIMT" },
      { kind: "declare", name: "FreeForAllChecker" },
      { kind: "declare", name: "FreeForAllEnforcer" },
      { kind: "declare", name: "ConstantInitialVoteBalance" },
    ]);
    expect(steps.filter((step) => step.kind === "invoke" || step.kind === "call")).toEqual([
      { kind: "invoke", name: "set_target" },
      { kind: "call", name: "coordinator" },
      { kind: "call", name: "get_poll_factory" },
    ]);
  });

  test("treats an empty checkpoint address as missing and still deploys", async () => {
    const ops = recordingOps();
    const result = await deployMaci(ops, SMALL_STANDUP_INTENT, { checkpoint: { leanImt: "" } });

    expect(ops.deploys).toHaveLength(5);
    expect(result.leanImt).not.toBe("");
  });

  test("reports steps completed before a coordinator mismatch", async () => {
    const ops = recordingOps({ coordinatorOnChain: "0x2" });
    const steps: DeployMaciStep[] = [];

    await expect(
      deployMaci(ops, SMALL_STANDUP_INTENT, {
        onStep: (step) => {
          steps.push(step);
        },
      }),
    ).rejects.toThrow(/coordinator mismatch/u);

    expect(steps.at(-1)).toEqual({ kind: "call", name: "coordinator" });
    expect(steps.some((step) => step.kind === "invoke")).toBe(true);
    expect(steps.some((step) => step.kind === "call" && step.name === "get_poll_factory")).toBe(false);
  });

  test("fails when on-chain coordinator does not match", async () => {
    const ops = recordingOps({ coordinatorOnChain: "0x2" });

    await expect(deployMaci(ops, SMALL_STANDUP_INTENT)).rejects.toThrow(/coordinator mismatch/u);
  });

  test("awaits onStep before the next sncast operation", async () => {
    const ops = recordingOps();
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const running = deployMaci(ops, SMALL_STANDUP_INTENT, {
      onStep: async (step): Promise<void> => {
        if (step.name === "LeanIMT") {
          await gate;
        }
      },
    });

    await Promise.resolve();
    expect(ops.deploys).toHaveLength(0);

    release?.();
    await running;

    expect(ops.deploys.length).toBeGreaterThan(0);
  });

  test("formatDeployMaci prints one labeled line per field", () => {
    const result: DeployMaciResult = {
      leanImt: "0x1",
      checker: "0x2",
      enforcer: "0x3",
      assigner: "0x4",
      pollClassHash: "0x5",
      pollFactoryClassHash: "0x6",
      maci: "0x7",
      pollFactory: "0x8",
      coordinator: "0x9",
      deployer: "0xa",
      network: "starknet_local",
    };

    expect(formatDeployMaci(result)).toBe(
      [
        "lean_imt: 0x1",
        "checker: 0x2",
        "enforcer: 0x3",
        "assigner: 0x4",
        "poll_class_hash: 0x5",
        "poll_factory_class_hash: 0x6",
        "maci: 0x7",
        "poll_factory: 0x8",
        "coordinator: 0x9",
        "deployer: 0xa",
        "network: starknet_local",
      ].join("\n"),
    );
  });
});
