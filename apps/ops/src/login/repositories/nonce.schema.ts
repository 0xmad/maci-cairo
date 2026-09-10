import { bigint, pgTable, text } from "drizzle-orm/pg-core";

export const operatorNonces = pgTable("operator_nonces", {
  nonce: text("nonce").primaryKey(),
  issuedAtMs: bigint("issued_at_ms", { mode: "number" }).notNull(),
});
