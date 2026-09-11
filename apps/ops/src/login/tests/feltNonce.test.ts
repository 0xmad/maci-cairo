import { typedData } from "starknet";
import { describe, expect, test } from "vitest";

import { randomFeltNonce } from "../utils/feltNonce.js";
import { operatorNonceMessage } from "../utils/nonceMessage.js";

const CHAIN_ID = "0x534e5f5345504f4c4941";

describe("randomFeltNonce", () => {
  test("hashes as a SNIP-12 felt", () => {
    const nonce = randomFeltNonce(new Uint8Array(31).fill(0xab));

    expect(nonce).toBe(`0x${"ab".repeat(31)}`);
    expect(typedData.getMessageHash(operatorNonceMessage(nonce, CHAIN_ID), "0x1")).toBe(
      "0x2f04d7221063f6b4aa354bb2331b9cc67959feddd25067389dedb743279259e",
    );
  });

  test("rejects a length that cannot fit in a felt", () => {
    expect(() => randomFeltNonce(new Uint8Array(32))).toThrow(/31 bytes/u);
  });
});
