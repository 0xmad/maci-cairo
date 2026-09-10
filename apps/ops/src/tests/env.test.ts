import { describe, expect, test } from "vitest";

import { readOpsEnv } from "../utils/env.js";

const REQUIRED = {
  DATABASE_URL: "postgres://maci:maci@127.0.0.1:5432/maci_ops",
  JWT_SECRET: "dev-jwt-secret",
  STARKNET_RPC_URL: "http://127.0.0.1:5050",
  STARKNET_CHAIN_ID: "SN_SEPOLIA",
};

describe("readOpsEnv", () => {
  test("reads required process env and defaults PORT", () => {
    expect(readOpsEnv(REQUIRED)).toEqual({
      databaseUrl: REQUIRED.DATABASE_URL,
      jwtSecret: REQUIRED.JWT_SECRET,
      starknetRpcUrl: REQUIRED.STARKNET_RPC_URL,
      starknetChainId: REQUIRED.STARKNET_CHAIN_ID,
      allowlist: [],
      port: 8787,
    });
  });

  test("parses PORT and OPERATOR_ALLOWLIST", () => {
    expect(
      readOpsEnv({
        ...REQUIRED,
        PORT: "9000",
        OPERATOR_ALLOWLIST: "0x1, 0x2",
      }),
    ).toEqual({
      databaseUrl: REQUIRED.DATABASE_URL,
      jwtSecret: REQUIRED.JWT_SECRET,
      starknetRpcUrl: REQUIRED.STARKNET_RPC_URL,
      starknetChainId: REQUIRED.STARKNET_CHAIN_ID,
      allowlist: [
        "0x0000000000000000000000000000000000000000000000000000000000000001",
        "0x0000000000000000000000000000000000000000000000000000000000000002",
      ],
      port: 9000,
    });
  });

  test("falls back to 8787 when PORT is not a TCP port", () => {
    expect(readOpsEnv({ ...REQUIRED, PORT: "nope" }).port).toBe(8787);
    expect(readOpsEnv({ ...REQUIRED, PORT: "" }).port).toBe(8787);
    expect(readOpsEnv({ ...REQUIRED, PORT: "0" }).port).toBe(8787);
    expect(readOpsEnv({ ...REQUIRED, PORT: "65536" }).port).toBe(8787);
  });

  test("rejects a missing required value", () => {
    expect(() => readOpsEnv({ ...REQUIRED, JWT_SECRET: "" })).toThrow(/missing JWT_SECRET/u);
    expect(() => readOpsEnv({ DATABASE_URL: REQUIRED.DATABASE_URL })).toThrow(/missing JWT_SECRET/u);
  });
});
