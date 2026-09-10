import { SignJWT } from "jose";
import { describe, expect, test } from "vitest";

import { createHash } from "node:crypto";

import { SessionService } from "../services/session.service.js";

const SECRET = "test-secret";
const NOW_MS = 1_000_000;

function hs256Key(secret: string): Uint8Array {
  return new Uint8Array(createHash("sha256").update(secret).digest());
}

describe("SessionService", () => {
  test("issues a token that read returns as the subject", async () => {
    const session = new SessionService({ secret: SECRET, ttlMs: 3_600_000 });
    const token = await session.issue("0xabc", NOW_MS);

    await expect(session.read(token, NOW_MS)).resolves.toBe("0xabc");
  });

  test("rejects a token with no subject", async () => {
    const iat = Math.floor(NOW_MS / 1000);
    const token = await new SignJWT()
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt(iat)
      .setExpirationTime(iat + 3_600)
      .sign(hs256Key(SECRET));
    const session = new SessionService({ secret: SECRET, ttlMs: 3_600_000 });

    await expect(session.read(token, NOW_MS)).rejects.toThrow(/invalid token/u);
  });
});
