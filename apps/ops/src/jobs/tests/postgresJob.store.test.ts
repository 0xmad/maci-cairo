import { describe, expect, test, vi } from "vitest";

import { createPollJobs } from "../../poll/poll.schema.js";
import { standupCheckpoints, type StandupCheckpointRow } from "../../standup/standup.schema.js";
import { type MaciInstanceRecord } from "../../standup/standup.store.js";
import { jobs, jobSteps } from "../job.schema.js";
import { type JobStep } from "../job.store.js";
import { PostgresJobStore } from "../postgresJob.store.js";

const STEP: JobStep = { seq: 1, kind: "declare", name: "LeanIMT" };

const JOB_ROW = {
  id: "job-1",
  kind: "standup",
  status: "succeeded",
  error: null,
  createdAtMs: 1_000_000,
  completedAtMs: 1_000_100,
};

type MaciRow = MaciInstanceRecord & {
  id: number;
  jobId: string;
  createdAtMs: number;
};

function postgresDb(
  options: {
    insertError?: Error;
    updateError?: Error;
    jobRows?: (typeof JOB_ROW)[];
    stepRows?: { jobId: string; seq: number; kind: string; name: string }[];
    checkpointRows?: StandupCheckpointRow[];
    createPollRows?: {
      jobId: string;
      maci: string;
      startDate: string;
      endDate: string;
      pollPublicKeyX: string;
      pollPublicKeyY: string;
      pollId: string | null;
    }[];
    maciRows?: MaciRow[];
    countRows?: { total?: number }[];
  } = {},
) {
  const jobInsertValues = vi.fn((): Promise<void> => {
    if (options.insertError !== undefined) {
      return Promise.reject(options.insertError);
    }

    return Promise.resolve();
  });
  const stepInsertValues = vi.fn((): Promise<void> => Promise.resolve());
  const maciInsertValues = vi.fn((): Promise<void> => Promise.resolve());
  const checkpointInsertValues = vi.fn(() => ({
    onConflictDoUpdate: vi.fn((): Promise<void> => Promise.resolve()),
  }));
  const createPollInsertValues = vi.fn(() => ({
    onConflictDoUpdate: vi.fn((): Promise<void> => Promise.resolve()),
  }));
  const insert = vi.fn((table: unknown) => {
    if (table === jobs) {
      return { values: jobInsertValues };
    }

    if (table === jobSteps) {
      return { values: stepInsertValues };
    }

    if (table === standupCheckpoints) {
      return { values: checkpointInsertValues };
    }

    if (table === createPollJobs) {
      return { values: createPollInsertValues };
    }

    return { values: maciInsertValues };
  });
  const where = vi.fn((): Promise<void> => {
    if (options.updateError !== undefined) {
      return Promise.reject(options.updateError);
    }

    return Promise.resolve();
  });
  const set = vi.fn(() => ({ where }));
  const update = vi.fn(() => ({ set }));
  const select = vi.fn(() => ({
    from: (table: unknown) => {
      if (table === jobs) {
        return {
          orderBy: () => ({
            limit: (): Promise<(typeof JOB_ROW)[]> => Promise.resolve(options.jobRows ?? []),
          }),
        };
      }

      if (table === jobSteps) {
        return {
          where: () => ({
            orderBy: (): Promise<{ jobId: string; seq: number; kind: string; name: string }[]> =>
              Promise.resolve(options.stepRows ?? []),
          }),
        };
      }

      if (table === standupCheckpoints) {
        return {
          where: () => ({
            limit: (): Promise<StandupCheckpointRow[]> => Promise.resolve(options.checkpointRows ?? []),
          }),
        };
      }

      if (table === createPollJobs) {
        return {
          where: () => ({
            limit: (): Promise<NonNullable<typeof options.createPollRows>> =>
              Promise.resolve(options.createPollRows ?? []),
          }),
        };
      }

      return {
        then: (resolve: (rows: { total?: number }[]) => unknown) =>
          Promise.resolve(options.countRows ?? [{ total: (options.maciRows ?? []).length }]).then(resolve),
        where: () => ({
          limit: (): Promise<MaciRow[]> => Promise.resolve(options.maciRows ?? []),
        }),
        orderBy: () => ({
          limit: (take: number) => {
            const rows = [...(options.maciRows ?? [])].sort((left, right) => right.id - left.id);

            return Object.assign(Promise.resolve(rows.slice(0, take)), {
              offset: (skip: number): Promise<MaciRow[]> => Promise.resolve(rows.slice(skip, skip + take)),
            });
          },
        }),
      };
    },
  }));
  const remove = vi.fn(() => ({ where: vi.fn((): Promise<void> => Promise.resolve()) }));
  const transaction = vi.fn(
    async (work: (tx: { insert: typeof insert; update: typeof update; delete: typeof remove }) => Promise<void>) =>
      work({ insert, update, delete: remove }),
  );

  return {
    db: { insert, update, select, delete: remove, transaction } as never,
    insert,
    jobInsertValues,
    stepInsertValues,
    maciInsertValues,
    checkpointInsertValues,
    createPollInsertValues,
    set,
    update,
    transaction,
    remove,
  };
}

describe("PostgresJobStore", () => {
  test("tryBegin inserts a running job", async () => {
    const { db, insert, jobInsertValues } = postgresDb();

    await expect(
      new PostgresJobStore(db).tryBegin({ id: "job-1", kind: "standup", createdAtMs: 1_000_000 }),
    ).resolves.toBe(true);
    expect(insert).toHaveBeenCalledWith(jobs);
    expect(jobInsertValues).toHaveBeenCalledWith({
      id: "job-1",
      kind: "standup",
      status: "running",
      createdAtMs: 1_000_000,
    });
  });

  test("tryBegin returns false on a unique violation", async () => {
    const { db } = postgresDb({ insertError: Object.assign(new Error("duplicate"), { code: "23505" }) });

    await expect(
      new PostgresJobStore(db).tryBegin({ id: "job-2", kind: "standup", createdAtMs: 1_000_001 }),
    ).resolves.toBe(false);
  });

  test("tryBegin rethrows other insert errors", async () => {
    const { db } = postgresDb({ insertError: new Error("db down") });

    await expect(
      new PostgresJobStore(db).tryBegin({ id: "job-1", kind: "standup", createdAtMs: 1_000_000 }),
    ).rejects.toThrow(/^db down$/u);
  });

  test("appendStep inserts a job step", async () => {
    const { db, insert, stepInsertValues } = postgresDb();

    await new PostgresJobStore(db).appendStep("job-1", STEP);

    expect(insert).toHaveBeenCalledWith(jobSteps);
    expect(stepInsertValues).toHaveBeenCalledWith({
      jobId: "job-1",
      seq: 1,
      kind: "declare",
      name: "LeanIMT",
    });
  });

  test("fail records the error on the job", async () => {
    const { db, update, set } = postgresDb();

    await new PostgresJobStore(db).fail("job-1", 1_000_100, "set_target failed");

    expect(update).toHaveBeenCalledWith(jobs);
    expect(set).toHaveBeenCalledWith({ status: "failed", completedAtMs: 1_000_100, error: "set_target failed" });
  });

  test("latest is undefined when no job rows exist", async () => {
    const { db } = postgresDb({ jobRows: [] });

    await expect(new PostgresJobStore(db).latest()).resolves.toBeUndefined();
  });

  test("latest returns the job and its steps", async () => {
    const { db } = postgresDb({
      jobRows: [JOB_ROW],
      stepRows: [{ jobId: "job-1", seq: 1, kind: "declare", name: "LeanIMT" }],
    });

    await expect(new PostgresJobStore(db).latest()).resolves.toEqual({
      id: "job-1",
      kind: "standup",
      status: "succeeded",
      steps: [STEP],
    });
  });

  test("latest returns an interrupted job", async () => {
    const { db } = postgresDb({
      jobRows: [{ ...JOB_ROW, status: "interrupted" }],
    });

    await expect(new PostgresJobStore(db).latest()).resolves.toMatchObject({
      id: "job-1",
      status: "interrupted",
    });
  });

  test("latest rejects an unknown job status", async () => {
    const { db } = postgresDb({
      jobRows: [{ ...JOB_ROW, status: "queued" }],
    });

    await expect(new PostgresJobStore(db).latest()).rejects.toThrow(/unknown job status queued/u);
  });

  test("interruptRunning marks the running job interrupted", async () => {
    const { db, update, set } = postgresDb();

    await new PostgresJobStore(db).interruptRunning(1_000_100, "interrupted");

    expect(update).toHaveBeenCalledWith(jobs);
    expect(set).toHaveBeenCalledWith({ status: "interrupted", completedAtMs: 1_000_100, error: "interrupted" });
  });

  test("tryResume reopens a failed job", async () => {
    const { db, set } = postgresDb({
      jobRows: [{ ...JOB_ROW, status: "failed" }],
    });

    await expect(new PostgresJobStore(db).tryResume("job-1")).resolves.toBe(true);
    expect(set).toHaveBeenCalledWith({ status: "running", error: null, completedAtMs: null });
  });

  test("tryResume returns false for a succeeded job", async () => {
    const { db } = postgresDb({ jobRows: [JOB_ROW] });

    await expect(new PostgresJobStore(db).tryResume("job-1")).resolves.toBe(false);
  });

  test("tryResume returns false on a unique violation", async () => {
    const { db } = postgresDb({
      jobRows: [{ ...JOB_ROW, status: "failed" }],
      updateError: Object.assign(new Error("duplicate"), { code: "23505" }),
    });

    await expect(new PostgresJobStore(db).tryResume("job-1")).resolves.toBe(false);
  });

  test("tryResume rethrows other update errors", async () => {
    const { db } = postgresDb({
      jobRows: [{ ...JOB_ROW, status: "interrupted" }],
      updateError: new Error("db down"),
    });

    await expect(new PostgresJobStore(db).tryResume("job-1")).rejects.toThrow(/^db down$/u);
  });

  test("latest returns a create_poll job kind", async () => {
    const { db } = postgresDb({
      jobRows: [{ ...JOB_ROW, kind: "create_poll" }],
    });

    await expect(new PostgresJobStore(db).latest()).resolves.toMatchObject({
      id: "job-1",
      kind: "create_poll",
    });
  });

  test("latest rejects an unknown job kind", async () => {
    const { db } = postgresDb({
      jobRows: [{ ...JOB_ROW, kind: "tally" }],
    });

    await expect(new PostgresJobStore(db).latest()).rejects.toThrow(/unknown job kind tally/u);
  });

  test("markSucceeded marks the job succeeded without recording a MACI", async () => {
    const { db, update, set, maciInsertValues } = postgresDb();

    await new PostgresJobStore(db).markSucceeded("job-1", 1_000_100);

    expect(update).toHaveBeenCalledWith(jobs);
    expect(set).toHaveBeenCalledWith({ status: "succeeded", completedAtMs: 1_000_100 });
    expect(maciInsertValues).not.toHaveBeenCalled();
  });
});
