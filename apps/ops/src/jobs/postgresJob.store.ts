import { and, desc, eq, inArray } from "drizzle-orm";
import { type NodePgDatabase } from "drizzle-orm/node-postgres";

import { jobs, jobSteps } from "./job.schema.js";
import {
  type JobKind,
  type JobSnapshot,
  type JobStatus,
  type JobStep,
  type JobStore,
  type NewJob,
} from "./job.store.js";

type JobDatabase = NodePgDatabase<{
  jobs: typeof jobs;
  jobSteps: typeof jobSteps;
}>;

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

function asKind(value: string): JobKind {
  if (value === "standup" || value === "create_poll") {
    return value;
  }

  throw new Error(`unknown job kind ${value}`);
}

function asStatus(value: string): JobStatus {
  if (value === "running" || value === "succeeded" || value === "failed" || value === "interrupted") {
    return value;
  }

  throw new Error(`unknown job status ${value}`);
}

function asStep(row: { seq: number; kind: string; name: string }): JobStep {
  return { seq: row.seq, kind: row.kind, name: row.name };
}

/** Postgres persistence for the shared job row and step log. */
export class PostgresJobStore implements JobStore {
  readonly #db: JobDatabase;

  constructor(db: JobDatabase) {
    this.#db = db;
  }

  async tryBegin(job: NewJob): Promise<boolean> {
    try {
      await this.#db.insert(jobs).values({
        id: job.id,
        kind: job.kind,
        status: "running",
        createdAtMs: job.createdAtMs,
      });

      return true;
    } catch (error) {
      if (isUniqueViolation(error)) {
        return false;
      }

      throw error;
    }
  }

  async appendStep(jobId: string, step: JobStep): Promise<void> {
    await this.#db.insert(jobSteps).values({
      jobId,
      seq: step.seq,
      kind: step.kind,
      name: step.name,
    });
  }

  async markSucceeded(jobId: string, completedAtMs: number): Promise<void> {
    await this.#db.update(jobs).set({ status: "succeeded", completedAtMs }).where(eq(jobs.id, jobId));
  }

  async fail(jobId: string, completedAtMs: number, error: string): Promise<void> {
    await this.#db.update(jobs).set({ status: "failed", completedAtMs, error }).where(eq(jobs.id, jobId));
  }

  async interruptRunning(completedAtMs: number, error: string): Promise<void> {
    await this.#db.update(jobs).set({ status: "interrupted", completedAtMs, error }).where(eq(jobs.status, "running"));
  }

  async tryResume(jobId: string): Promise<boolean> {
    const latest = await this.latest();

    if (latest?.id !== jobId || (latest.status !== "failed" && latest.status !== "interrupted")) {
      return false;
    }

    try {
      await this.#db
        .update(jobs)
        .set({ status: "running", error: null, completedAtMs: null })
        .where(and(eq(jobs.id, jobId), inArray(jobs.status, ["failed", "interrupted"])));

      return true;
    } catch (error) {
      if (isUniqueViolation(error)) {
        return false;
      }

      throw error;
    }
  }

  async latest(): Promise<JobSnapshot | undefined> {
    const rows = await this.#db.select().from(jobs).orderBy(desc(jobs.createdAtMs)).limit(1);

    if (rows.length === 0) {
      return undefined;
    }

    const row = rows[0];

    const steps = await this.#db.select().from(jobSteps).where(eq(jobSteps.jobId, row.id)).orderBy(jobSteps.seq);

    return {
      id: row.id,
      kind: asKind(row.kind),
      status: asStatus(row.status),
      error: row.error ?? undefined,
      steps: steps.map((step) => asStep(step)),
    };
  }
}
