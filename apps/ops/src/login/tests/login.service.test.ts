import { describe, expect, test } from "vitest";

import { PostgresNonceRepository } from "../repositories/postgresNonce.repository.js";
import { LoginService } from "../services/login.service.js";
import { SessionService } from "../services/session.service.js";
import { normalizeHex } from "../utils/allowlist.js";

const OPERATOR = "0x1";
const OTHER = "0x2";

function proof(address: string): string {
  return JSON.stringify({ address, signature: ["0x1", "0x2"] });
}

function verifyWalletProof(_nonce: string, signature: string): Promise<string> {
  return Promise.resolve((JSON.parse(signature) as { address: string }).address);
}

function eqParam(condition: { queryChunks: unknown[] }): string {
  const param = condition.queryChunks.find(
    (chunk): chunk is { value: string } =>
      typeof chunk === "object" && chunk !== null && "value" in chunk && typeof chunk.value === "string",
  );

  if (param === undefined) {
    throw new Error("expected eq string param");
  }

  return param.value;
}

function postgresNonceRepository(): PostgresNonceRepository {
  const saved = new Map<string, number>();

  return new PostgresNonceRepository({
    insert: () => ({
      values: (row: { nonce: string; issuedAtMs: number }): Promise<void> => {
        saved.set(row.nonce, row.issuedAtMs);

        return Promise.resolve();
      },
    }),
    delete: () => ({
      where: (condition: { queryChunks: unknown[] }): { returning: () => Promise<{ nonce: string }[]> } => ({
        returning: (): Promise<{ nonce: string }[]> => {
          const nonce = eqParam(condition);
          // Map#delete, not drizzle-orm's query builder.
          // eslint-disable-next-line drizzle/enforce-delete-with-where -- in-memory Map
          const existed = saved.delete(nonce);

          return Promise.resolve(existed ? [{ nonce }] : []);
        },
      }),
    }),
  } as unknown as ConstructorParameters<typeof PostgresNonceRepository>[0]);
}

function loginHarness(
  options: {
    allowlist?: string[];
    nowMs?: () => number;
    walletService?: { verify: (nonce: string, signature: string) => Promise<string> };
  } = {},
) {
  let now = 1_000_000;
  let n = 0;
  const nonceRepository = postgresNonceRepository();

  const service = new LoginService({
    nonceRepository,
    sessionService: new SessionService({ secret: "test-secret", ttlMs: 3_600_000 }),
    nowMs: options.nowMs ?? ((): number => now),
    randomNonce: (): string => {
      n += 1;
      return `nonce-${n}`;
    },
    walletService: options.walletService ?? { verify: verifyWalletProof },
    allowlist: options.allowlist ?? [OPERATOR],
  });

  return {
    service,
    advance(ms: number): void {
      now += ms;
    },
  };
}

describe("LoginService", () => {
  test("issues a nonce and mints a session token for an allowlisted Operator", async () => {
    const { service } = loginHarness();
    const nonce = await service.issueNonce();

    expect(nonce).toBe("nonce-1");

    const signed = await service.login(nonce, proof(OPERATOR));

    expect(signed.address).toBe(normalizeHex(OPERATOR));
    expect(signed.token.split(".")).toHaveLength(3);
    await expect(service.authenticate(signed.token)).resolves.toBe(normalizeHex(OPERATOR));
  });

  test("rejects a reused nonce", async () => {
    const { service } = loginHarness();
    const nonce = await service.issueNonce();
    const signature = proof(OPERATOR);

    await service.login(nonce, signature);

    await expect(service.login(nonce, signature)).rejects.toThrow(/invalid nonce/u);
  });

  test("rejects an address that is not on the allowlist", async () => {
    const { service } = loginHarness();
    const nonce = await service.issueNonce();

    await expect(service.login(nonce, proof(OTHER))).rejects.toThrow(/not allowlisted/u);
  });

  test("re-checks the allowlist on authenticate so a smaller list revokes the session", async () => {
    const nonceRepository = postgresNonceRepository();
    const sessionService = new SessionService({ secret: "test-secret", ttlMs: 3_600_000 });
    let n = 0;
    const shared = {
      nonceRepository,
      sessionService,
      nowMs: (): number => 1_000_000,
      randomNonce: (): string => {
        n += 1;
        return `nonce-${n}`;
      },
      walletService: { verify: verifyWalletProof },
    };

    const first = new LoginService({ ...shared, allowlist: [OPERATOR] });
    const nonce = await first.issueNonce();
    const { token } = await first.login(nonce, proof(OPERATOR));

    const second = new LoginService({ ...shared, allowlist: [] });

    await expect(second.authenticate(token)).rejects.toThrow(/not allowlisted/u);
  });

  test("rejects an expired session token", async () => {
    let now = 1_000_000;
    const { service } = loginHarness({ nowMs: (): number => now });
    const nonce = await service.issueNonce();
    const { token } = await service.login(nonce, proof(OPERATOR));

    now += 3_600_001;

    await expect(service.authenticate(token)).rejects.toThrow(/invalid token/u);
  });
});
