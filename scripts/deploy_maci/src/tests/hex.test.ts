import { describe, expect, test } from "vitest";

import { intendedCoordinator, normalizeHex } from "../hex.js";

describe("normalizeHex", () => {
  test("pads the seed-0 devnet-1 account to 32 bytes", () => {
    expect(normalizeHex("0x64b48806902a367c8598f4f95c305e8c1a1acba5f082d294a43793113115691")).toBe(
      "0x064b48806902a367c8598f4f95c305e8c1a1acba5f082d294a43793113115691",
    );
  });

  test("rejects non-hex input", () => {
    expect(() => {
      normalizeHex("0xzz");
    }).toThrow("invalid hex: 0xzz");
  });
});

describe("intendedCoordinator", () => {
  test("uses the seed-0 account when override is empty", () => {
    expect(intendedCoordinator("")).toBe("0x064b48806902a367c8598f4f95c305e8c1a1acba5f082d294a43793113115691");
  });

  test("uses a non-empty override", () => {
    expect(intendedCoordinator("0x1")).toBe("0x0000000000000000000000000000000000000000000000000000000000000001");
  });
});
