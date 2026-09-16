import { describe, expect, test } from "vitest";

import {
  isDatetimeLocalValue,
  startOfLocalDay,
  toDatetimeLocalValue,
  unixSecondsFromDatetimeLocal,
} from "../datetimeLocal.js";

describe("datetimeLocal", () => {
  test("formats a local date and time for datetime-local", () => {
    expect(toDatetimeLocalValue(new Date(2026, 8, 16, 9, 5))).toBe("2026-09-16T09:05");
  });

  test("formats the start of a local day", () => {
    expect(startOfLocalDay(new Date(2026, 8, 16, 15, 40))).toBe("2026-09-16T00:00");
  });

  test("converts datetime-local to unix seconds", () => {
    expect(unixSecondsFromDatetimeLocal("2026-09-16T09:05")).toBe(
      Math.floor(new Date(2026, 8, 16, 9, 5).getTime() / 1000),
    );
  });

  test("accepts datetime-local values and rejects other strings", () => {
    expect(isDatetimeLocalValue("2026-09-16T09:05")).toBe(true);
    expect(isDatetimeLocalValue("2026-09-16")).toBe(false);
  });
});
