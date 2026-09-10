import { describe, expect, test, vi } from "vitest";

import { operatorNonces } from "../repositories/nonce.schema.js";
import { PostgresNonceRepository } from "../repositories/postgresNonce.repository.js";

function postgresDb(consumeRows: { nonce: string }[] = []) {
  const values = vi.fn((): Promise<void> => Promise.resolve());
  const insert = vi.fn(() => ({ values }));
  const returning = vi.fn((): Promise<{ nonce: string }[]> => Promise.resolve(consumeRows));
  const where = vi.fn(() => ({ returning }));
  const del = vi.fn(() => ({ where }));

  return {
    db: { insert, delete: del } as unknown as ConstructorParameters<typeof PostgresNonceRepository>[0],
    del,
    insert,
    values,
  };
}

describe("PostgresNonceRepository", () => {
  test("saves a nonce", async () => {
    const { db, insert, values } = postgresDb();

    await new PostgresNonceRepository(db).save("nonce-1", 1_000_000);

    expect(insert).toHaveBeenCalledWith(operatorNonces);
    expect(values).toHaveBeenCalledWith({ nonce: "nonce-1", issuedAtMs: 1_000_000 });
  });

  test("consume returns true when a row is deleted", async () => {
    const { db, del } = postgresDb([{ nonce: "nonce-1" }]);

    await expect(new PostgresNonceRepository(db).consume("nonce-1")).resolves.toBe(true);
    expect(del).toHaveBeenCalledWith(operatorNonces);
  });

  test("consume returns false when no row is deleted", async () => {
    const { db } = postgresDb([]);

    await expect(new PostgresNonceRepository(db).consume("missing")).resolves.toBe(false);
  });
});
