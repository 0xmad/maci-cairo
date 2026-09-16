import { describe, expect, test } from "vitest";

import { pollOps } from "./sncastFixtures.js";

describe("pollOps", () => {
  test("declare and deploy return fixed class and address placeholders", () => {
    const ops = pollOps();

    expect(ops.declareClass("Poll")).toBe("0x1");
    expect(ops.deployUnique("0x1")).toBe("0x2");
  });

  test("returns a placeholder for an unmatched field call", () => {
    const ops = pollOps();

    expect(ops.field("maci", ["call", "unknown"])).toBe("0x1");
    expect(ops.fieldCalls).toEqual([["call", "unknown"]]);
  });

  test("get_poll after invoke defaults to 0xaa", () => {
    const ops = pollOps();

    expect(ops.field("maci", ["invoke", "create_poll"])).toBe("0xabc");
    expect(ops.field("maci", ["call", "get_poll"])).toBe("0xaa");
  });

  test("poll_id falls back to nextPollId then 0x0", () => {
    expect(pollOps({ nextPollId: "0x5" }).field("maci", ["call", "poll_id"])).toBe("0x5");
    expect(pollOps().field("maci", ["call", "poll_id"])).toBe("0x0");
  });
});
