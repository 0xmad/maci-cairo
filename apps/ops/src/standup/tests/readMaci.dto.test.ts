import { BadRequestException } from "@nestjs/common";
import { describe, expect, test } from "vitest";

import { parseReadMaciParamsDto } from "../dto/readMaci.dto.js";

describe("parseReadMaciParamsDto", () => {
  test("returns the MACI address", () => {
    expect(parseReadMaciParamsDto({ address: "0x7" })).toBe("0x7");
  });

  test("rejects a missing address", () => {
    expect(() => parseReadMaciParamsDto(undefined)).toThrow(BadRequestException);
    expect(() => parseReadMaciParamsDto({})).toThrow(
      expect.objectContaining({ response: { error: "maci address required" } }),
    );
  });

  test("rejects an empty address", () => {
    expect(() => parseReadMaciParamsDto({ address: "" })).toThrow(BadRequestException);
  });

  test("rejects extra params", () => {
    expect(() => parseReadMaciParamsDto({ address: "0x7", extra: "yes" })).toThrow(BadRequestException);
  });
});
