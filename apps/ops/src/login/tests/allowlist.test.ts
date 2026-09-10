import { describe, expect, test } from "vitest";

import { normalizeHex, parseAllowlist } from "../utils/allowlist.js";

describe("parseAllowlist", () => {
  test("parses comma-separated Operator addresses", () => {
    expect(parseAllowlist("0x1, 0x2")).toEqual([
      "0x0000000000000000000000000000000000000000000000000000000000000001",
      "0x0000000000000000000000000000000000000000000000000000000000000002",
    ]);
  });

  test("returns empty when unset", () => {
    expect(parseAllowlist(undefined)).toEqual([]);
    expect(parseAllowlist("")).toEqual([]);
    expect(parseAllowlist("   ")).toEqual([]);
  });

  test("rejects an entry that is not hex", () => {
    expect(() => parseAllowlist("0x1, not-hex")).toThrow(/invalid hex/u);
  });
});

describe("normalizeHex", () => {
  test("lowercases and pads a felt to 32 bytes", () => {
    expect(normalizeHex("0xAb")).toBe("0x00000000000000000000000000000000000000000000000000000000000000ab");
  });

  test("rejects empty hex", () => {
    expect(() => normalizeHex("0x")).toThrow(/invalid hex: 0x/u);
    expect(() => normalizeHex("   ")).toThrow(/invalid hex/u);
  });

  test("rejects non-hex characters", () => {
    expect(() => normalizeHex("0xzz")).toThrow(/invalid hex: 0xzz/u);
  });
});
