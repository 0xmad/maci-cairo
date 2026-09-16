import { bigint, integer, pgTable, text } from "drizzle-orm/pg-core";

export const standupCheckpoints = pgTable("standup_checkpoints", {
  id: integer("id").primaryKey(),
  leanImt: text("lean_imt"),
  checker: text("checker"),
  enforcer: text("enforcer"),
  assigner: text("assigner"),
  maci: text("maci"),
});

export type StandupCheckpointRow = typeof standupCheckpoints.$inferSelect;

export const maciInstances = pgTable("maci_instances", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  leanImt: text("lean_imt").notNull(),
  checker: text("checker").notNull(),
  enforcer: text("enforcer").notNull(),
  assigner: text("assigner").notNull(),
  pollClassHash: text("poll_class_hash").notNull(),
  pollFactoryClassHash: text("poll_factory_class_hash").notNull(),
  maci: text("maci").notNull(),
  pollFactory: text("poll_factory").notNull(),
  coordinator: text("coordinator").notNull(),
  deployer: text("deployer").notNull(),
  circuitProfile: text("circuit_profile").notNull(),
  policy: text("policy").notNull(),
  voteBalanceAssigner: text("vote_balance_assigner").notNull(),
  jobId: text("job_id").notNull(),
  network: text("network").notNull(),
  createdAtMs: bigint("created_at_ms", { mode: "number" }).notNull(),
});
