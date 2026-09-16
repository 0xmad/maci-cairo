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
  type CreatePollStep,
} from "../createPoll.js";
import { DEVNET_SEED0_DEVNET_1, normalizeHex } from "../hex.js";

const EXAMPLE_PATH = path.resolve(import.meta.dirname, "../../create-poll.example.json");

const VALID_JSON = `{
  "maci": "0x7",
  "start_date": 0,
  "end_date": 1000,
  "poll_public_key": [0, 1]
}`;

function recordingOps(
  options: {
    coordinatorOnChain?: string;
    nextPollIdOnChain?: string;
    poll?: string;
    pollId?: string;
    pollExists?: boolean;
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

      if (args[0] === "call" && args.includes("next_poll_id")) {
        return options.nextPollIdOnChain ?? "0x0";
      }

      if (args[0] === "invoke") {
        created = true;
        return "0xabc";
      }

      if (args[0] === "call" && args.includes("get_poll")) {
        if (created || options.pollExists === true) {
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
  test("accepts only maci, schedule, and poll public key", () => {
    const config = parseCreatePollConfig(VALID_JSON);

    expect(config.maci).toBe(normalizeHex("0x7"));
    expect(config.startDate).toBe(0n);
    expect(config.endDate).toBe(1000n);
    expect(config.pollPublicKey).toEqual([0n, 1n]);
  });

  test("accepts hex and decimal strings for schedule and poll public key", () => {
    const config = parseCreatePollConfig(`{
      "maci": "0x7",
      "start_date": "0",
      "end_date": "0x3e8",
      "poll_public_key": ["0", "0x1"]
    }`);

    expect(config.startDate).toBe(0n);
    expect(config.endDate).toBe(1000n);
    expect(config.pollPublicKey).toEqual([0n, 1n]);
  });

  test("parses the committed example file", () => {
    const config = parseCreatePollConfig(readFileSync(EXAMPLE_PATH, "utf8"));

    expect(config.maci).toBe(normalizeHex("0x0"));
    expect(config.startDate).toBe(0n);
    expect(config.endDate).toBe(1000n);
    expect(config.pollPublicKey).toEqual([0n, 1n]);
  });

  test("rejects poll_id and other unknown keys", () => {
    expect(() => {
      parseCreatePollConfig(VALID_JSON.replace('"poll_public_key": [0, 1]', '"poll_public_key": [0, 1], "poll_id": 0'));
    }).toThrow(/unknown key poll_id/u);
  });

  test.each(["state_tree_depth", "vote_options", "batch_size", "empty_live_ballot_root"] as const)(
    "rejects old dimension key %s",
    (key) => {
      expect(() => {
        parseCreatePollConfig(
          VALID_JSON.replace('"poll_public_key": [0, 1]', `"poll_public_key": [0, 1], "${key}": 1`),
        );
      }).toThrow(new RegExp(`unknown key ${key}`, "u"));
    },
  );

  test("rejects a missing start_date", () => {
    expect(() => {
      parseCreatePollConfig(`{"maci":"0x1","end_date":1,"poll_public_key":[0,1]}`);
    }).toThrow(/missing key start_date/u);
  });

  test("rejects a missing key", () => {
    expect(() => {
      parseCreatePollConfig(`{"maci":"0x1","start_date":0,"end_date":1}`);
    }).toThrow(/missing key poll_public_key/u);
  });

  test("rejects a missing maci", () => {
    expect(() => {
      parseCreatePollConfig(`{"start_date":0,"end_date":1,"poll_public_key":[0,1]}`);
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
  test("preflights coordinator then invokes create_poll without Circuit-profile fields", async () => {
    const ops = recordingOps({ poll: "0xbb", pollId: "0x0" });
    const config = parseCreatePollConfig(VALID_JSON);
    const result = await createPoll(ops, config);

    expect(ops.fields[0]?.args).toEqual(["call", "--contract-address", config.maci, "--function", "coordinator"]);
    expect(ops.fields[1]?.args).toEqual(["call", "--contract-address", config.maci, "--function", "next_poll_id"]);
    expect(ops.fields[2]).toEqual({
      key: "transaction_hash",
      args: [
        "invoke",
        "--contract-address",
        config.maci,
        "--function",
        "create_poll",
        "--arguments",
        "maci_contracts::PollFactory::CreatePollArgs { start_date: 0, end_date: 1000, poll_public_key: (0, 1) }",
      ],
    });
    expect(ops.fields[3]?.args).toEqual([
      "call",
      "--contract-address",
      config.maci,
      "--function",
      "get_poll",
      "--arguments",
      "0",
    ]);
    expect(ops.fields[4]?.args).toEqual(["call", "--contract-address", result.poll, "--function", "poll_id"]);
    expect(result).toEqual({
      maci: config.maci,
      poll: normalizeHex("0xbb"),
      pollId: "0",
    });
  });

  test("reports preflight, invoke, and get_poll steps when onStep is set", async () => {
    const ops = recordingOps({ poll: "0xbb", pollId: "0x0" });
    const steps: CreatePollStep[] = [];

    await createPoll(ops, parseCreatePollConfig(VALID_JSON), {
      onStep: (step) => {
        steps.push(step);
      },
    });

    expect(steps).toEqual([
      { kind: "call", name: "coordinator" },
      { kind: "call", name: "next_poll_id" },
      { kind: "invoke", name: "create_poll" },
      { kind: "call", name: "get_poll" },
    ]);
  });

  test("accepts an intended coordinator that matches on-chain", async () => {
    const ops = recordingOps({ coordinatorOnChain: "0x2", poll: "0xbb", pollId: "0x0" });

    await expect(
      createPoll(ops, parseCreatePollConfig(VALID_JSON), { intendedCoordinator: "0x2" }),
    ).resolves.toMatchObject({ pollId: "0" });
  });

  test("fails when on-chain coordinator is not seed-0 devnet-1", async () => {
    const ops = recordingOps({ coordinatorOnChain: "0x2" });
    const steps: CreatePollStep[] = [];

    await expect(
      createPoll(ops, parseCreatePollConfig(VALID_JSON), {
        onStep: (step) => {
          steps.push(step);
        },
      }),
    ).rejects.toThrow(/coordinator mismatch/u);

    expect(steps).toEqual([{ kind: "call", name: "coordinator" }]);
  });

  test("does not call state_tree_depth", async () => {
    const ops = recordingOps({ poll: "0xbb", pollId: "0x0" });

    await createPoll(ops, parseCreatePollConfig(VALID_JSON));

    expect(ops.fields.some((field) => field.args.includes("state_tree_depth"))).toBe(false);
  });

  test("reads decimal sncast felts for next_poll_id and poll_id", async () => {
    const ops = recordingOps({ nextPollIdOnChain: "1", poll: "0xcc", pollId: "1" });
    const result = await createPoll(ops, parseCreatePollConfig(VALID_JSON));

    expect(ops.fields[3]?.args.at(-1)).toBe("1");
    expect(result.pollId).toBe("1");
  });

  test("fails when sncast next_poll_id is not an integer felt", async () => {
    const ops = recordingOps({ nextPollIdOnChain: "nope" });

    await expect(createPoll(ops, parseCreatePollConfig(VALID_JSON))).rejects.toThrow(/invalid integer: nope/u);
  });

  test("looks up the Poll at the on-chain next_poll_id", async () => {
    const config = parseCreatePollConfig(VALID_JSON);
    const ops = recordingOps({ nextPollIdOnChain: "0x1", poll: "0xcc", pollId: "0x1" });
    const result = await createPoll(ops, config);

    expect(ops.fields[3]?.args.at(-1)).toBe("1");
    expect(result).toEqual({
      maci: config.maci,
      poll: normalizeHex("0xcc"),
      pollId: "1",
    });
  });

  test("skips invoke when a frozen poll id already has a nonzero get_poll", async () => {
    const ops = recordingOps({ poll: "0xbb", pollId: "0x1", pollExists: true });
    const config = parseCreatePollConfig(VALID_JSON);
    const result = await createPoll(ops, config, { frozenPollId: 1n });

    expect(ops.fields.some((field) => field.args[0] === "invoke")).toBe(false);
    expect(ops.fields.some((field) => field.args.includes("next_poll_id"))).toBe(false);
    expect(ops.fields[0]?.args).toEqual(["call", "--contract-address", config.maci, "--function", "coordinator"]);
    expect(ops.fields[1]?.args).toEqual([
      "call",
      "--contract-address",
      config.maci,
      "--function",
      "get_poll",
      "--arguments",
      "1",
    ]);
    expect(result).toEqual({
      maci: config.maci,
      poll: normalizeHex("0xbb"),
      pollId: "1",
    });
  });

  test("fails skip-invoke when on-chain coordinator does not match", async () => {
    const ops = recordingOps({ poll: "0xbb", pollId: "0x1", pollExists: true, coordinatorOnChain: "0x2" });

    await expect(createPoll(ops, parseCreatePollConfig(VALID_JSON), { frozenPollId: 1n })).rejects.toThrow(
      /coordinator mismatch/u,
    );
    expect(ops.fields.some((field) => field.args[0] === "invoke")).toBe(false);
  });

  test("invokes once when a frozen poll id still has a zero get_poll", async () => {
    const ops = recordingOps({ poll: "0xcc", pollId: "0x2" });
    const config = parseCreatePollConfig(VALID_JSON);
    const steps: CreatePollStep[] = [];
    const result = await createPoll(ops, config, {
      frozenPollId: 2n,
      onStep: (step) => {
        steps.push(step);
      },
    });

    expect(ops.fields.filter((field) => field.args[0] === "invoke")).toHaveLength(1);
    expect(ops.fields.some((field) => field.args.includes("next_poll_id"))).toBe(false);
    expect(steps).toEqual([
      { kind: "call", name: "coordinator" },
      { kind: "call", name: "get_poll" },
      { kind: "invoke", name: "create_poll" },
      { kind: "call", name: "get_poll" },
    ]);
    expect(result.poll).toBe(normalizeHex("0xcc"));
    expect(result.pollId).toBe("2");
  });

  test("fails when get_poll is still zero after create_poll", async () => {
    const ops = recordingOps({ poll: "0x0" });
    const steps: CreatePollStep[] = [];

    await expect(
      createPoll(ops, parseCreatePollConfig(VALID_JSON), {
        onStep: (step) => {
          steps.push(step);
        },
      }),
    ).rejects.toThrow(/did not record a Poll at id 0/u);

    expect(steps).toEqual([
      { kind: "call", name: "coordinator" },
      { kind: "call", name: "next_poll_id" },
      { kind: "invoke", name: "create_poll" },
      { kind: "call", name: "get_poll" },
    ]);
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
