import { BadRequestException } from "@nestjs/common";
import { describe, expect, test } from "vitest";

import { parseReadPollParamsDto } from "../dto/readPoll.dto.js";

describe("parseReadPollParamsDto", () => {
  test("reads the Poll address", () => {
    expect(parseReadPollParamsDto({ pollAddress: "0xaa" })).toBe("0xaa");
  });

  test("rejects missing path params", () => {
    expect(() => parseReadPollParamsDto({})).toThrow(BadRequestException);
    expect(() => parseReadPollParamsDto({})).toThrow(
      expect.objectContaining({ response: { error: "poll address required" } }),
    );
  });
});
