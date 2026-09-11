import { randomBytes } from "node:crypto";

/**
 * 31 random bytes as `0x` hex. 32 unprefixed hex digits are encoded as a
 * shortstring (`… is too long`); 32-byte hex exceeds the field modulus.
 */
export function randomFeltNonce(bytes: Uint8Array = randomBytes(31)): string {
  if (bytes.length !== 31) {
    throw new Error(`felt nonce must be 31 bytes, got ${bytes.length}`);
  }

  return `0x${Buffer.from(bytes).toString("hex")}`;
}
