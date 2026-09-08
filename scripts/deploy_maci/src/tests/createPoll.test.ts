import { describe, expect, test } from "vitest";

import { readFileSync } from "node:fs";
import path from "node:path";

import {
  createPoll,
  formatCreatePoll,
  parseCreatePollArgv,
  parseCreatePollConfig,
  type CreatePollOps,
  type CreatePollResult,
} from "../createPoll.js";
import { DEVNET_SEED0_DEVNET_1, normalizeHex } from "../hex.js";

const EXAMPLE_PATH = path.resolve(import.meta.dirname, "../../create-poll.example.json");

const VALID_JSON = `{
  "maci": "0x7",
  "start_date": 0,
  "end_date": 1000,
  "poll_public_key": [0, 1],
  "state_tree_depth": 5,
  "vote_options": 2,
  "batch_size": 2,
  "empty_live_ballot_root": "0xabc"
}`;

function recordingOps(
  options: {
    coordinatorOnChain?: string;
    depthOnChain?: string;
    nextPollIdOnChain?: string;
    poll?: string;
    pollId?: string;
  } = {},
): CreatePollOps & { fields: { key: string; args: string[] }[] } {
  const fields: { key: string; args: string[] }[] = [];
  let created = false;

  return {
    fields,
    field(key: string, args: string[]): string {
      fields.push({ key, args });

      if (args[0] === "call" && args.includes("coordinator")) {
        return options.coordinatorOnChain ?? DEVNET_SEED0_DEVNET_1;
      }

      if (args[0] === "call" && args.includes("state_tree_depth")) {
        return options.depthOnChain ?? "0x5";
      }

      if (args[0] === "call" && args.includes("next_poll_id")) {
        return options.nextPollIdOnChain ?? "0x0";
      }

      if (args[0] === "invoke") {
        created = true;
        return "0xabc";
      }

      if (args[0] === "call" && args.includes("get_poll")) {
        if (created) {
          return options.poll ?? "0xaa";
        }

        return "0x0";
      }

      if (args[0] === "call" && args.includes("poll_id")) {
        return options.pollId ?? "0x0";
      }

      return "0xdead";
    },
  };
}

describe("parseCreatePollConfig", () => {
  test("accepts fixture keys with hex empty live-ballot root", () => {
    const config = parseCreatePollConfig(VALID_JSON);

    expect(config.maci).toBe(normalizeHex("0x7"));
    expect(config.startDate).toBe(0n);
    expect(config.endDate).toBe(1000n);
    expect(config.pollPublicKey).toEqual([0n, 1n]);
    expect(config.stateTreeDepth).toBe(5n);
    expect(config.voteOptions).toBe(2n);
    expect(config.batchSize).toBe(2n);
    expect(config.emptyLiveBallotRoot).toBe(0xabcn);
  });

  test("parses the committed example file", () => {
    const config = parseCreatePollConfig(readFileSync(EXAMPLE_PATH, "utf8"));

    expect(config.maci).toBe(normalizeHex("0x0"));
    expect(config.stateTreeDepth).toBe(5n);
    expect(config.emptyLiveBallotRoot).toBe(0xabcn);
  });

  test("rejects poll_id and other unknown keys", () => {
    expect(() => {
      parseCreatePollConfig(VALID_JSON.replace('"batch_size": 2', '"batch_size": 2, "poll_id": 0'));
    }).toThrow(/unknown key poll_id/u);
  });

  test("rejects a missing key", () => {
    expect(() => {
      parseCreatePollConfig(
        `{"maci":"0x1","start_date":0,"end_date":1,"poll_public_key":[0,1],"state_tree_depth":5,"vote_options":1,"batch_size":1}`,
      );
    }).toThrow(/missing key empty_live_ballot_root/u);
  });

  test("rejects a missing maci", () => {
    expect(() => {
      parseCreatePollConfig(
        `{"start_date":0,"end_date":1,"poll_public_key":[0,1],"state_tree_depth":5,"vote_options":1,"batch_size":1,"empty_live_ballot_root":1}`,
      );
    }).toThrow(/missing key maci/u);
  });

  test("rejects a non-hex maci", () => {
    expect(() => {
      parseCreatePollConfig(VALID_JSON.replace('"0x7"', '"0xzz"'));
    }).toThrow(/invalid hex: 0xzz/u);
  });

  test("rejects a non-tuple poll_public_key", () => {
    expect(() => {
      parseCreatePollConfig(VALID_JSON.replace("[0, 1]", "0"));
    }).toThrow(/Invalid input/u);
  });

  test("rejects a JSON array", () => {
    expect(() => {
      parseCreatePollConfig("[]");
    }).toThrow(/create-poll config must be a JSON object/u);
  });
});

describe("createPoll", () => {
  test("preflights coordinator and depth then invokes create_poll", () => {
    const ops = recordingOps({ poll: "0xbb", pollId: "0x0" });
    const config = parseCreatePollConfig(VALID_JSON);
    const result = createPoll(ops, config);

    expect(ops.fields[0]?.args).toEqual(["call", "--contract-address", config.maci, "--function", "coordinator"]);
    expect(ops.fields[1]?.args).toEqual(["call", "--contract-address", config.maci, "--function", "state_tree_depth"]);
    expect(ops.fields[2]?.args).toEqual(["call", "--contract-address", config.maci, "--function", "next_poll_id"]);
    expect(ops.fields[3]).toEqual({
      key: "transaction_hash",
      args: [
        "invoke",
        "--contract-address",
        config.maci,
        "--function",
        "create_poll",
        "--arguments",
        "maci_contracts::PollFactory::CreatePollArgs { start_date: 0, end_date: 1000, poll_public_key: (0, 1), state_tree_depth: 5, vote_options: 2, batch_size: 2, empty_live_ballot_root: 2748 }",
      ],
    });
    expect(ops.fields[4]?.args).toEqual([
      "call",
      "--contract-address",
      config.maci,
      "--function",
      "get_poll",
      "--arguments",
      "0",
    ]);
    expect(ops.fields[5]?.args).toEqual(["call", "--contract-address", result.poll, "--function", "poll_id"]);
    expect(result).toEqual({
      maci: config.maci,
      poll: normalizeHex("0xbb"),
      pollId: "0",
    });
  });

  test("fails when on-chain coordinator is not seed-0 devnet-1", () => {
    const ops = recordingOps({ coordinatorOnChain: "0x2" });

    expect(() => {
      createPoll(ops, parseCreatePollConfig(VALID_JSON));
    }).toThrow(/coordinator mismatch/u);
  });

  test("fails when on-chain state tree depth does not match the config", () => {
    const ops = recordingOps({ depthOnChain: "0x4" });

    expect(() => {
      createPoll(ops, parseCreatePollConfig(VALID_JSON));
    }).toThrow(/state_tree_depth mismatch/u);
  });

  test("reads decimal sncast felts for depth and poll_id", () => {
    const ops = recordingOps({ depthOnChain: "5", pollId: "1" });
    const result = createPoll(ops, parseCreatePollConfig(VALID_JSON));

    expect(result.pollId).toBe("1");
  });

  test("fails when sncast depth is not an integer felt", () => {
    const ops = recordingOps({ depthOnChain: "nope" });

    expect(() => {
      createPoll(ops, parseCreatePollConfig(VALID_JSON));
    }).toThrow(/invalid integer: nope/u);
  });

  test("looks up the Poll at the on-chain next_poll_id", () => {
    const config = parseCreatePollConfig(VALID_JSON);
    const ops = recordingOps({ nextPollIdOnChain: "0x1", poll: "0xcc", pollId: "0x1" });
    const result = createPoll(ops, config);

    expect(ops.fields[4]?.args.at(-1)).toBe("1");
    expect(result).toEqual({
      maci: config.maci,
      poll: normalizeHex("0xcc"),
      pollId: "1",
    });
  });

  test("fails when get_poll is still zero after create_poll", () => {
    const ops = recordingOps({ poll: "0x0" });

    expect(() => {
      createPoll(ops, parseCreatePollConfig(VALID_JSON));
    }).toThrow(/did not record a Poll at id 0/u);
  });

  test("formatCreatePoll prints maci, poll, and poll_id", () => {
    const result: CreatePollResult = {
      maci: "0x1",
      poll: "0x2",
      pollId: "0",
    };

    expect(formatCreatePoll(result)).toBe(["maci: 0x1", "poll: 0x2", "poll_id: 0"].join("\n"));
  });
});

describe("parseCreatePollArgv", () => {
  test("reads --config <path>", () => {
    expect(parseCreatePollArgv(["--config", "./poll.json"])).toBe("./poll.json");
  });

  test("reads --config after a leading --", () => {
    expect(parseCreatePollArgv(["--", "--config", "./poll.json"])).toBe("./poll.json");
  });

  test("reads --config=<path>", () => {
    expect(parseCreatePollArgv(["--config=./poll.json"])).toBe("./poll.json");
  });

  test("rejects a missing --config", () => {
    expect(() => {
      parseCreatePollArgv(["./poll.json"]);
    }).toThrow(/usage: create-poll --config <path>/u);
  });

  test("rejects --config without a path", () => {
    expect(() => {
      parseCreatePollArgv(["--config"]);
    }).toThrow(/usage: create-poll --config <path>/u);
  });

  test("rejects an empty --config=", () => {
    expect(() => {
      parseCreatePollArgv(["--config="]);
    }).toThrow(/usage: create-poll --config <path>/u);
  });

  test("rejects extra tokens after --config=", () => {
    expect(() => {
      parseCreatePollArgv(["--config=./poll.json", "extra"]);
    }).toThrow(/usage: create-poll --config <path>/u);
  });

  test("rejects empty argv", () => {
    expect(() => {
      parseCreatePollArgv([]);
    }).toThrow(/usage: create-poll --config <path>/u);
  });
});
