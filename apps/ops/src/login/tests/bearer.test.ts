import { describe, expect, test } from "vitest";

import { readBearer } from "../utils/bearer.js";

describe("readBearer", () => {
  test("uses the first value when Authorization is an array", () => {
    expect(readBearer(["Bearer abc", "Bearer other"])).toBe("abc");
  });

  test("uses the first comma-separated value on a single header string", () => {
    expect(readBearer("Bearer abc, Bearer other")).toBe("abc");
  });
});
