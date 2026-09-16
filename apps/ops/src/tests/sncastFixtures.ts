import { intendedCoordinator, normalizeHex } from "maci-deploy/hex";
import { type SncastOps } from "maci-deploy/maci";

import { type MaciInstanceRecord } from "../standup/standup.store.js";

export function padIndex(index: number): string {
  return normalizeHex(`0x${index.toString(16)}`);
}

export function recordingOps(
  options: { failOn?: "set_target" | "coordinator"; failOnDeploy?: number; coordinatorOnChain?: string } = {},
): SncastOps & {
  fieldCalls: string[][];
  deploys: string[];
  declares: string[];
  maciCoordinatorArg?: string;
  assignerArg?: string;
} {
  let next = 1;
  const fieldCalls: string[][] = [];
  const ops: SncastOps & {
    fieldCalls: string[][];
    deploys: string[];
    declares: string[];
    maciCoordinatorArg?: string;
    assignerArg?: string;
  } = {
    fieldCalls,
    deploys: [],
    declares: [],
    declareClass(contractName: string): string {
      ops.declares.push(contractName);
      const classHash = padIndex(next);
      next += 1;
      return classHash;
    },
    deployUnique(_classHash: string, argumentsExpr?: string): string {
      if (options.failOnDeploy === ops.deploys.length + 1) {
        throw new Error("deploy failed");
      }

      const coordinator = argumentsExpr?.match(/coordinator: (0x[0-9a-f]+)/u)?.[1];

      if (coordinator !== undefined) {
        ops.maciCoordinatorArg = coordinator;
      } else if (argumentsExpr !== undefined && !argumentsExpr.includes(",")) {
        ops.assignerArg = argumentsExpr;
      }

      const address = padIndex(next);
      next += 1;
      ops.deploys.push(address);

      return address;
    },
    field(_key: string, args: string[]): string {
      fieldCalls.push(args);

      if (args.includes("set_target") && options.failOn === "set_target") {
        throw new Error("set_target failed");
      }

      if (args[0] === "call" && args.includes("coordinator")) {
        if (options.failOn === "coordinator") {
          throw new Error("coordinator check failed");
        }

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

export const CREATE_POLL_INTENT = {
  startDate: 0n,
  endDate: 1000n,
  pollPublicKey: [0n, 1n] as const,
};

export function pollOps(
  options: {
    coordinatorOnChain?: string;
    nextPollId?: string;
    pollBefore?: string;
    pollAfter?: string;
    pollId?: string;
  } = {},
): SncastOps & { fieldCalls: string[][] } {
  const fieldCalls: string[][] = [];
  let invoked = false;

  return {
    fieldCalls,
    declareClass: (): string => "0x1",
    deployUnique: (): string => "0x2",
    field(_key: string, args: string[]): string {
      fieldCalls.push(args);

      if (args[0] === "call" && args.includes("coordinator")) {
        return options.coordinatorOnChain ?? intendedCoordinator(undefined);
      }

      if (args[0] === "call" && args.includes("next_poll_id")) {
        return options.nextPollId ?? "0x0";
      }

      if (args[0] === "invoke") {
        invoked = true;

        return "0xabc";
      }

      if (args[0] === "call" && args.includes("get_poll")) {
        if (invoked) {
          return options.pollAfter ?? "0xaa";
        }

        return options.pollBefore ?? "0x0";
      }

      if (args[0] === "call" && args.includes("poll_id")) {
        return options.pollId ?? options.nextPollId ?? "0x0";
      }

      return "0x1";
    },
  };
}

export const MACI_INSTANCE: MaciInstanceRecord = {
  leanImt: "0x1",
  checker: "0x2",
  enforcer: "0x3",
  assigner: "0x4",
  pollClassHash: "0x5",
  pollFactoryClassHash: "0x6",
  maci: "0x7",
  pollFactory: "0x8",
  coordinator: "0x1",
  deployer: "0xa",
  network: "starknet_local",
  circuitProfile: "small",
  policy: "Free for all",
  voteBalanceAssigner: "Constant vote balance",
};
