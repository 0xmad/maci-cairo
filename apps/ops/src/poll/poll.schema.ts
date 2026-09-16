import { bigint, integer, pgTable, text } from "drizzle-orm/pg-core";

export const createPollJobs = pgTable("create_poll_jobs", {
  jobId: text("job_id").primaryKey(),
  maci: text("maci").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  pollPublicKeyX: text("poll_public_key_x").notNull(),
  pollPublicKeyY: text("poll_public_key_y").notNull(),
  pollId: text("poll_id"),
});

export const polls = pgTable("polls", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  maci: text("maci").notNull(),
  address: text("address").notNull(),
  pollId: text("poll_id").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  pollPublicKeyX: text("poll_public_key_x").notNull(),
  pollPublicKeyY: text("poll_public_key_y").notNull(),
  createdAtMs: bigint("created_at_ms", { mode: "number" }).notNull(),
});
