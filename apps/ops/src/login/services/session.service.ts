import { SignJWT, jwtVerify } from "jose";
import { object, string } from "zod";

import { createHash } from "node:crypto";

const sessionPayloadSchema = object({ sub: string() }).loose();

export interface SessionServiceDeps {
  secret: string;
  ttlMs: number;
}

function hs256Key(secret: string): Uint8Array {
  return new Uint8Array(createHash("sha256").update(secret).digest());
}

/** Hours-TTL JWT session tokens for Operator login. */
export class SessionService {
  readonly #secret: string;

  readonly #ttlMs: number;

  constructor(deps: SessionServiceDeps) {
    this.#secret = deps.secret;
    this.#ttlMs = deps.ttlMs;
  }

  async issue(subject: string, nowMs: number): Promise<string> {
    const iat = Math.floor(nowMs / 1000);

    return new SignJWT()
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(subject)
      .setIssuedAt(iat)
      .setExpirationTime(iat + Math.floor(this.#ttlMs / 1000))
      .sign(hs256Key(this.#secret));
  }

  async read(token: string, nowMs: number): Promise<string> {
    try {
      const { payload } = await jwtVerify(token, hs256Key(this.#secret), {
        algorithms: ["HS256"],
        currentDate: new Date(nowMs),
      });
      const parsed = sessionPayloadSchema.safeParse(payload);

      if (!parsed.success) {
        throw new Error("invalid token");
      }

      return parsed.data.sub;
    } catch {
      throw new Error("invalid token");
    }
  }
}
