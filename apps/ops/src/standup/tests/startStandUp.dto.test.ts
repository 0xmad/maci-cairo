import { BadRequestException } from "@nestjs/common";
import { describe, expect, test } from "vitest";

import { parseStartStandUpDto } from "../dto/startStandUp.dto.js";

const BODY = {
  circuitProfile: "small",
  policy: "Free for all",
  assigner: "Constant vote balance",
};

describe("parseStartStandUpDto", () => {
  test("maps an omitted voteBalance to intent without a constant amount", () => {
    expect(parseStartStandUpDto(BODY)).toEqual(BODY);
  });

  test("maps an integer voteBalance to constantVoteBalance", () => {
    expect(parseStartStandUpDto({ ...BODY, voteBalance: 7 })).toEqual({
      ...BODY,
      constantVoteBalance: 7n,
    });
  });

  test("maps a numeric string voteBalance to constantVoteBalance", () => {
    expect(parseStartStandUpDto({ ...BODY, voteBalance: "7" })).toEqual({
      ...BODY,
      constantVoteBalance: 7n,
    });
  });

  test("rejects a missing required field", () => {
    expect(() => parseStartStandUpDto({ circuitProfile: "small", policy: "Free for all" })).toThrow(
      BadRequestException,
    );
    expect(() => parseStartStandUpDto({ circuitProfile: "small", policy: "Free for all" })).toThrow(
      expect.objectContaining({ response: { error: "circuitProfile, policy, and assigner required" } }),
    );
  });

  test("rejects extra fields", () => {
    expect(() => parseStartStandUpDto({ ...BODY, checker: "0x1" })).toThrow(BadRequestException);
  });

  test("rejects a non-integer voteBalance number", () => {
    expect(() => parseStartStandUpDto({ ...BODY, voteBalance: 1.5 })).toThrow(BadRequestException);
    expect(() => parseStartStandUpDto({ ...BODY, voteBalance: 1.5 })).toThrow(
      expect.objectContaining({ response: { error: "invalid vote balance" } }),
    );
  });

  test("rejects a voteBalance string that is not an integer", () => {
    expect(() => parseStartStandUpDto({ ...BODY, voteBalance: "1.5" })).toThrow(BadRequestException);
    expect(() => parseStartStandUpDto({ ...BODY, voteBalance: "1.5" })).toThrow(
      expect.objectContaining({ response: { error: "invalid vote balance" } }),
    );
  });
});
