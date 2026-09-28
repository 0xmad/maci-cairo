import { type UnboundUserKeyRecord, type UserPublicKey } from "./unboundUserKey";

/** Packed `Base8 * 7` from `@zk-kit/baby-jubjub` (same vector as web pollPublicKey tests). */
export const PACKED_BASE8_TIMES_7_HEX = "9ac7675df6265f6e12d1c79a2b3b6658a0d46a320fba497ad0b817f9b19e0f21";

export const BASE8_TIMES_7: UserPublicKey = {
  x: "20092560661213339045022877747484245238324772779820628739268223482659246842641",
  y: "12112450042127193446189577552007703839818242727902437791835414514847797088033",
};

export const fixedPublicKey = BASE8_TIMES_7;

export const fixedRecord: UnboundUserKeyRecord = {
  privateKey: "99",
  publicKey: fixedPublicKey,
};

export const bigintToBytes32 = (value: bigint): Uint8Array => {
  const hex = value.toString(16).padStart(64, "0");

  return Uint8Array.from(
    Array.from({ length: 32 }, (_, index) => Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16)),
  );
};
