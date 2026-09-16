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
