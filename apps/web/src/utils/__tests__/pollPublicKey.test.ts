import { describe, expect, test } from "vitest";

import { pollPublicKeySchema, serializePollPublicKey } from "../pollPublicKey.js";

/** Packed `Base8 * 7` from `@zk-kit/baby-jubjub`. */
const PACKED_BASE8_TIMES_7 = "70008494660785291157975070056351657766453235060722719811564206518804361908001";
const PACKED_BASE8_TIMES_7_HEX = "9ac7675df6265f6e12d1c79a2b3b6658a0d46a320fba497ad0b817f9b19e0f21";
const BASE8_TIMES_7: [string, string] = [
  "20092560661213339045022877747484245238324772779820628739268223482659246842641",
  "12112450042127193446189577552007703839818242727902437791835414514847797088033",
];

describe("pollPublicKeySchema", () => {
  test("unpacks a packed BabyJub public key", () => {
    expect(pollPublicKeySchema.parse("1")).toEqual(["0", "1"]);
    expect(pollPublicKeySchema.parse("0x9ac7675df6265f6e12d1c79a2b3b6658a0d46a320fba497ad0b817f9b19e0f21")).toEqual(
      BASE8_TIMES_7,
    );
    expect(pollPublicKeySchema.parse(PACKED_BASE8_TIMES_7)).toEqual(BASE8_TIMES_7);
  });

  test("rejects a value that is not a packed public key", () => {
    expect(pollPublicKeySchema.safeParse("hello").success).toBe(false);
    expect(pollPublicKeySchema.safeParse("3,4").success).toBe(false);
    expect(pollPublicKeySchema.safeParse("2").success).toBe(false);
  });
});

describe("serializePollPublicKey", () => {
  test("serializes coordinates as macipk. packed hex", () => {
    expect(serializePollPublicKey(["0", "1"])).toBe("macipk.01");
    expect(serializePollPublicKey(BASE8_TIMES_7)).toBe(`macipk.${PACKED_BASE8_TIMES_7_HEX}`);
  });
});
