import { describe, expect, test } from "vitest";

import { readRelayerEnv } from "../utils/env.js";

describe("readRelayerEnv", () => {
  test("defaults missing or empty PORT to 8788", () => {
    expect(readRelayerEnv({}).port).toBe(8788);
    expect(readRelayerEnv({ PORT: "" }).port).toBe(8788);
  });

  test("reads a TCP PORT", () => {
    expect(readRelayerEnv({ PORT: "9000" })).toEqual({ port: 9000 });
  });

  test("throws when PORT is not a TCP port", () => {
    expect(() => readRelayerEnv({ PORT: "nope" })).toThrow(/invalid PORT/u);
    expect(() => readRelayerEnv({ PORT: "0" })).toThrow(/invalid PORT/u);
    expect(() => readRelayerEnv({ PORT: "65536" })).toThrow(/invalid PORT/u);
  });
});
