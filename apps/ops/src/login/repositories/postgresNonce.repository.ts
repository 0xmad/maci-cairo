import { eq } from "drizzle-orm";
import { type NodePgDatabase } from "drizzle-orm/node-postgres";

import { type NonceRepository } from "./nonce.repository.js";
import { operatorNonces } from "./nonce.schema.js";

type NonceDatabase = NodePgDatabase<{ operatorNonces: typeof operatorNonces }>;

/** Postgres persistence for Operator login nonces. */
export class PostgresNonceRepository implements NonceRepository {
  readonly #db: NonceDatabase;

  constructor(db: NonceDatabase) {
    this.#db = db;
  }

  async save(nonce: string, issuedAtMs: number): Promise<void> {
    await this.#db.insert(operatorNonces).values({ nonce, issuedAtMs });
  }

  async consume(nonce: string): Promise<boolean> {
    const rows = await this.#db
      .delete(operatorNonces)
      .where(eq(operatorNonces.nonce, nonce))
      .returning({ nonce: operatorNonces.nonce });

    return rows.length > 0;
  }
}
