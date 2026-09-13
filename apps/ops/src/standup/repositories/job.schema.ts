import { bigint, integer, pgTable, primaryKey, text } from "drizzle-orm/pg-core";

export const jobs = pgTable("jobs", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  status: text("status").notNull(),
  error: text("error"),
  createdAtMs: bigint("created_at_ms", { mode: "number" }).notNull(),
  completedAtMs: bigint("completed_at_ms", { mode: "number" }),
});

export const jobSteps = pgTable(
  "job_steps",
  {
    jobId: text("job_id").notNull(),
    seq: integer("seq").notNull(),
    kind: text("kind").notNull(),
    name: text("name").notNull(),
  },
  (table) => [primaryKey({ columns: [table.jobId, table.seq] })],
);

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
  jobId: text("job_id").notNull(),
  network: text("network").notNull(),
  createdAtMs: bigint("created_at_ms", { mode: "number" }).notNull(),
});
