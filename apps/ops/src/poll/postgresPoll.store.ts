import { count, desc, eq } from "drizzle-orm";
import { type NodePgDatabase } from "drizzle-orm/node-postgres";

import { type Page, type Pagination } from "../utils/pagination.js";

import { createPollJobs, polls } from "./poll.schema.js";
import { type CreatePollJob, type PollListItem, type PollStore } from "./poll.store.js";

type PollDatabase = NodePgDatabase<{
  createPollJobs: typeof createPollJobs;
  polls: typeof polls;
}>;

/** Postgres persistence for Create Poll attempts and recorded Polls. */
export class PostgresPollStore implements PollStore {
  readonly #db: PollDatabase;

  constructor(db: PollDatabase) {
    this.#db = db;
  }

  async writeCreatePoll(jobId: string, record: CreatePollJob): Promise<void> {
    const row = {
      jobId,
      maci: record.maci,
      startDate: record.startDate,
      endDate: record.endDate,
      pollPublicKeyX: record.pollPublicKeyX,
      pollPublicKeyY: record.pollPublicKeyY,
      pollId: record.pollId ?? null,
    };

    await this.#db
      .insert(createPollJobs)
      .values(row)
      .onConflictDoUpdate({
        target: createPollJobs.jobId,
        set: {
          maci: row.maci,
          startDate: row.startDate,
          endDate: row.endDate,
          pollPublicKeyX: row.pollPublicKeyX,
          pollPublicKeyY: row.pollPublicKeyY,
          pollId: row.pollId,
        },
      });
  }

  async readCreatePoll(jobId: string): Promise<CreatePollJob | undefined> {
    const rows = await this.#db.select().from(createPollJobs).where(eq(createPollJobs.jobId, jobId)).limit(1);

    if (rows.length === 0) {
      return undefined;
    }

    const row = rows[0];

    return {
      maci: row.maci,
      startDate: row.startDate,
      endDate: row.endDate,
      pollPublicKeyX: row.pollPublicKeyX,
      pollPublicKeyY: row.pollPublicKeyY,
      ...(row.pollId == null || row.pollId.length === 0 ? {} : { pollId: row.pollId }),
    };
  }

  async recordPoll(record: PollListItem & { maci: string }): Promise<void> {
    await this.#db.insert(polls).values({
      maci: record.maci,
      address: record.address,
      pollId: record.pollId,
      startDate: record.startDate,
      endDate: record.endDate,
      pollPublicKeyX: record.pollPublicKey[0],
      pollPublicKeyY: record.pollPublicKey[1],
      createdAtMs: record.createdAtMs,
    });
  }

  async listPolls(maci: string, pagination: Pagination): Promise<Page<PollListItem>> {
    const [totals, rows] = await Promise.all([
      this.#db.select({ total: count() }).from(polls).where(eq(polls.maci, maci)),
      this.#db
        .select()
        .from(polls)
        .where(eq(polls.maci, maci))
        .orderBy(desc(polls.id))
        .limit(pagination.pageSize)
        .offset((pagination.page - 1) * pagination.pageSize),
    ]);

    return {
      items: rows.map((row): PollListItem => ({
        address: row.address,
        pollId: row.pollId,
        startDate: row.startDate,
        endDate: row.endDate,
        pollPublicKey: [row.pollPublicKeyX, row.pollPublicKeyY],
        createdAtMs: row.createdAtMs,
      })),
      total: totals[0]?.total ?? 0,
    };
  }
}
