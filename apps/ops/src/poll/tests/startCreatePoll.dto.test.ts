import { BadRequestException } from "@nestjs/common";
import { describe, expect, test } from "vitest";

import { parseStartCreatePollDto } from "../dto/startCreatePoll.dto.js";

const BODY = {
  startDate: 0,
  endDate: 1000,
  pollPublicKey: [0, 1],
};

describe("parseStartCreatePollDto", () => {
  test("maps schedule and Poll public key", () => {
    expect(parseStartCreatePollDto(BODY)).toEqual({
      startDate: 0n,
      endDate: 1000n,
      pollPublicKey: [0n, 1n],
    });
  });

  test("maps hex and decimal strings", () => {
    expect(
      parseStartCreatePollDto({
        startDate: "0",
        endDate: "0x3e8",
        pollPublicKey: ["0", "0x1"],
      }),
    ).toEqual({
      startDate: 0n,
      endDate: 1000n,
      pollPublicKey: [0n, 1n],
    });
  });

  test("rejects a missing required field", () => {
    expect(() => parseStartCreatePollDto({ startDate: 0, endDate: 1 })).toThrow(BadRequestException);
    expect(() => parseStartCreatePollDto({ startDate: 0, endDate: 1 })).toThrow(
      expect.objectContaining({ response: { error: "startDate, endDate, and pollPublicKey required" } }),
    );
  });

  test("rejects a pasted MACI address", () => {
    expect(() => parseStartCreatePollDto({ ...BODY, maci: "0x1" })).toThrow(BadRequestException);
  });

  test("rejects vote options and batch size", () => {
    expect(() => parseStartCreatePollDto({ ...BODY, voteOptions: 5 })).toThrow(BadRequestException);
    expect(() => parseStartCreatePollDto({ ...BODY, batchSize: 4 })).toThrow(BadRequestException);
  });

  test("rejects a startDate that is not a number or string", () => {
    expect(() => parseStartCreatePollDto({ ...BODY, startDate: true })).toThrow(BadRequestException);
    expect(() => parseStartCreatePollDto({ ...BODY, startDate: true })).toThrow(
      expect.objectContaining({ response: { error: "invalid startDate" } }),
    );
  });

  test("rejects a startDate that is not an unsigned integer", () => {
    expect(() => parseStartCreatePollDto({ ...BODY, startDate: "hello" })).toThrow(BadRequestException);
    expect(() => parseStartCreatePollDto({ ...BODY, startDate: "hello" })).toThrow(
      expect.objectContaining({ response: { error: "invalid startDate" } }),
    );
  });

  test("rejects a non-integer startDate", () => {
    expect(() => parseStartCreatePollDto({ ...BODY, startDate: 1.5 })).toThrow(BadRequestException);
    expect(() => parseStartCreatePollDto({ ...BODY, startDate: 1.5 })).toThrow(
      expect.objectContaining({ response: { error: "invalid startDate" } }),
    );
  });
});
