import { describe, expect, test } from "vitest";

import { readRelayerEnv } from "../utils/env.js";

const ACCOUNT = {
  STARKNET_RPC_URL: "http://127.0.0.1:5050",
  STARKNET_ACCOUNT_ADDRESS: "0x11",
  STARKNET_ACCOUNT_PRIVATE_KEY: "0x22",
};

describe("readRelayerEnv", () => {
  test("defaults missing, empty, or non-string PORT to 8788", () => {
    expect(readRelayerEnv(ACCOUNT).port).toBe(8788);
    expect(readRelayerEnv({ ...ACCOUNT, PORT: "" }).port).toBe(8788);
    expect(readRelayerEnv({ ...ACCOUNT, PORT: 9000 }).port).toBe(8788);
  });

  test("reads a TCP PORT and the Relayer account", () => {
    expect(readRelayerEnv({ ...ACCOUNT, PORT: "9000" })).toEqual({
      port: 9000,
      starknetRpcUrl: "http://127.0.0.1:5050",
      starknetAccountAddress: "0x11",
      starknetAccountPrivateKey: "0x22",
    });
  });

  test("throws when PORT is not a TCP port", () => {
    expect(() => readRelayerEnv({ ...ACCOUNT, PORT: "nope" })).toThrow(/invalid PORT/u);
    expect(() => readRelayerEnv({ ...ACCOUNT, PORT: "0" })).toThrow(/invalid PORT/u);
    expect(() => readRelayerEnv({ ...ACCOUNT, PORT: "65536" })).toThrow(/invalid PORT/u);
  });

  test("throws when the Relayer account is missing or not a felt", () => {
    expect(() => readRelayerEnv({ PORT: "8788" })).toThrow(/missing STARKNET_RPC_URL/u);
    expect(() => readRelayerEnv({ ...ACCOUNT, STARKNET_ACCOUNT_ADDRESS: "" })).toThrow(
      /invalid STARKNET_ACCOUNT_ADDRESS/u,
    );
    expect(() => readRelayerEnv({ ...ACCOUNT, STARKNET_ACCOUNT_ADDRESS: "nope" })).toThrow(
      /invalid STARKNET_ACCOUNT_ADDRESS/u,
    );
    expect(() => readRelayerEnv({ ...ACCOUNT, STARKNET_ACCOUNT_PRIVATE_KEY: "" })).toThrow(
      /invalid STARKNET_ACCOUNT_PRIVATE_KEY/u,
    );
  });

  test("reports an env that is not a record as a missing RPC URL", () => {
    expect(() => readRelayerEnv([])).toThrow(/missing STARKNET_RPC_URL/u);
  });
});
