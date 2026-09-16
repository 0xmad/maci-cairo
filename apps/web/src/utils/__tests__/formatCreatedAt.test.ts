import { describe, expect, it } from "vitest";

import { formatCreatedAt, formatUnixSeconds } from "../formatCreatedAt.js";

describe("formatCreatedAt", () => {
  it("renders UTC date and time from epoch milliseconds", () => {
    expect(formatCreatedAt(Date.UTC(2026, 8, 13, 23, 40, 5))).toBe("2026-09-13 23:40 UTC");
  });

  it("renders UTC date and time from unix seconds", () => {
    expect(formatUnixSeconds(String(Date.UTC(2026, 8, 16, 10, 0, 0) / 1000))).toBe("2026-09-16 10:00 UTC");
  });
});
