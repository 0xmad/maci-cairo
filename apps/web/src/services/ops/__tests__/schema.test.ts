import { describe, expect, test } from "vitest";

import { unixSecondsFromDatetimeLocal } from "../../../utils/datetimeLocal.js";
import { createPollIntentSchema } from "../schema.js";

const START = "2026-12-01T10:00";
const END = "2026-12-02T10:00";

describe("createPollIntentSchema", () => {
  test("converts datetime-local schedule to unix seconds", () => {
    expect(
      createPollIntentSchema.parse({
        startDate: START,
        endDate: END,
        pollPublicKey: "1",
      }),
    ).toEqual({
      startDate: unixSecondsFromDatetimeLocal(START),
      endDate: unixSecondsFromDatetimeLocal(END),
      pollPublicKey: ["0", "1"],
    });
  });

  test("rejects a start date before today", () => {
    const parsed = createPollIntentSchema.safeParse({
      startDate: "2020-01-01T00:00",
      endDate: END,
      pollPublicKey: "1",
    });

    expect(parsed.success).toBe(false);
    expect(parsed.success ? [] : parsed.error.issues.map((issue) => issue.message)).toContain(
      "Start must not be before today",
    );
  });

  test("rejects an end date before start", () => {
    const parsed = createPollIntentSchema.safeParse({
      startDate: END,
      endDate: START,
      pollPublicKey: "1",
    });

    expect(parsed.success).toBe(false);
    expect(parsed.success ? [] : parsed.error.issues.map((issue) => issue.message)).toContain(
      "End must not be before start",
    );
  });

  test("rejects a schedule that is not a date and time", () => {
    const parsed = createPollIntentSchema.safeParse({
      startDate: "not-a-date",
      endDate: END,
      pollPublicKey: "1",
    });

    expect(parsed.success).toBe(false);
    expect(parsed.success ? [] : parsed.error.issues.map((issue) => issue.message)).toContain(
      "Must be a date and time",
    );
  });
});
