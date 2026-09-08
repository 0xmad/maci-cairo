import { describe, expect, test } from "vitest";

import { DEVNET_SEED0_DEVNET_1, intendedCoordinator, normalizeHex } from "../hex.js";
import {
  EMPTY_BALLOT_ROOTS,
  STATE_TREE_DEPTH,
  VOTE_BALANCE,
  deployMaci,
  formatDeployMaci,
  type DeployMaciResult,
  type SncastOps,
} from "../maci.js";

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
  test("declares and deploys in MACI deploy order", () => {
    const ops = recordingOps();
    const result = deployMaci(ops);

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
  });

  test("uses COORDINATOR_OVERRIDE in MACI constructor calldata", () => {
    const ops = recordingOps({
      coordinatorOnChain: intendedCoordinator("0x1"),
    });
    const result = deployMaci(ops, { coordinatorOverride: "0x1" });

    expect(ops.deploys[4]?.argumentsExpr).toContain(`coordinator: ${intendedCoordinator("0x1")}`);
    expect(result.coordinator).toBe(intendedCoordinator("0x1"));
  });

  test("fails when on-chain coordinator does not match", () => {
    const ops = recordingOps({ coordinatorOnChain: "0x2" });

    expect(() => {
      deployMaci(ops);
    }).toThrow(/coordinator mismatch/u);
  });

  test("formatDeployMaci prints one labeled hex line per MACI address", () => {
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
      ].join("\n"),
    );
  });
});
