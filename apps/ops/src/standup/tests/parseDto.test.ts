import { BadRequestException } from "@nestjs/common";
import { IsString, MinLength } from "class-validator";
import { describe, expect, test } from "vitest";

import { parseDto } from "../dto/parseDto.js";

class NameDto {
  @IsString()
  @MinLength(1)
  name!: string;
}

describe("parseDto", () => {
  test("returns a DTO instance for a valid object", () => {
    expect(parseDto(NameDto, { name: "small" }, "name required")).toMatchObject({ name: "small" });
  });

  test("treats undefined as an empty object and rejects it when fields are required", () => {
    expect(() => parseDto(NameDto, undefined, "name required")).toThrow(BadRequestException);
    expect(() => parseDto(NameDto, undefined, "name required")).toThrow(
      expect.objectContaining({ response: { error: "name required" } }),
    );
  });

  test.each([null, "small", 1, true, ["small"]] as const)("rejects a non-object value %j", (value: unknown) => {
    expect(() => parseDto(NameDto, value, "name required")).toThrow(BadRequestException);
    expect(() => parseDto(NameDto, value, "name required")).toThrow(
      expect.objectContaining({ response: { error: "name required" } }),
    );
  });
});
