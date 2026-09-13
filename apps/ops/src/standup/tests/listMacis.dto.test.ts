import { describe, expect, test } from "vitest";

import { parseListMacisQueryDto } from "../dto/listMacis.dto.js";

describe("parseListMacisQueryDto", () => {
  test("defaults to page 1 and pageSize 10", () => {
    expect(parseListMacisQueryDto(undefined)).toEqual({ page: 1, pageSize: 10 });
    expect(parseListMacisQueryDto({})).toEqual({ page: 1, pageSize: 10 });
  });

  test("reads page and pageSize from query strings", () => {
    expect(parseListMacisQueryDto({ page: "2", pageSize: "1" })).toEqual({ page: 2, pageSize: 1 });
  });

  test("reads page and pageSize from numbers", () => {
    expect(parseListMacisQueryDto({ page: 3, pageSize: 5 })).toEqual({ page: 3, pageSize: 5 });
  });

  test("keeps extra query keys while reading pagination", () => {
    expect(parseListMacisQueryDto({ page: "2", extra: "yes" })).toEqual({ page: 2, pageSize: 10 });
  });

  test("caps pageSize at 50", () => {
    expect(parseListMacisQueryDto({ pageSize: "100" })).toEqual({ page: 1, pageSize: 50 });
  });

  test("falls back when page or pageSize is not a positive integer", () => {
    expect(parseListMacisQueryDto({ page: "0", pageSize: "nope" })).toEqual({ page: 1, pageSize: 10 });
  });

  test("rejects a non-object query", () => {
    expect(() => parseListMacisQueryDto(["2"])).toThrow(
      expect.objectContaining({ response: { error: "invalid pagination" } }),
    );
  });
});
