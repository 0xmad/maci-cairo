import { describe, expect, test, vi } from "vitest";

import { jobs, jobSteps, maciInstances } from "../repositories/job.schema.js";
import { type CurrentMaci, type JobStep } from "../repositories/job.store.js";
import { PostgresJobStore } from "../repositories/postgresJob.store.js";

const MACI: CurrentMaci = {
  leanImt: "0x1",
  checker: "0x2",
  enforcer: "0x3",
  assigner: "0x4",
  pollClassHash: "0x5",
  pollFactoryClassHash: "0x6",
  maci: "0x7",
  pollFactory: "0x8",
  coordinator: "0x9",
};

const STEP: JobStep = { seq: 1, kind: "declare", name: "LeanIMT" };

const JOB_ROW = {
  id: "job-1",
  kind: "standup",
  status: "succeeded",
  error: null,
  createdAtMs: 1_000_000,
  completedAtMs: 1_000_100,
};

const MACI_ROW = {
  id: 1,
  leanImt: MACI.leanImt,
  checker: MACI.checker,
  enforcer: MACI.enforcer,
  assigner: MACI.assigner,
  pollClassHash: MACI.pollClassHash,
  pollFactoryClassHash: MACI.pollFactoryClassHash,
  maci: MACI.maci,
  pollFactory: MACI.pollFactory,
  coordinator: MACI.coordinator,
  jobId: "job-1",
};

function postgresDb(
  options: {
    insertError?: Error;
    jobRows?: (typeof JOB_ROW)[];
    stepRows?: { jobId: string; seq: number; kind: string; name: string }[];
    maciRows?: (typeof MACI_ROW)[];
  } = {},
) {
  const jobInsertValues = vi.fn((): Promise<void> => {
    if (options.insertError !== undefined) {
      return Promise.reject(options.insertError);
    }

    return Promise.resolve();
  });
  const stepInsertValues = vi.fn((): Promise<void> => Promise.resolve());
  const maciOnConflict = vi.fn((): Promise<void> => Promise.resolve());
  const maciInsertValues = vi.fn(() => ({ onConflictDoUpdate: maciOnConflict }));
  const insert = vi.fn((table: unknown) => {
    if (table === jobs) {
      return { values: jobInsertValues };
    }

    if (table === jobSteps) {
      return { values: stepInsertValues };
    }

    return { values: maciInsertValues };
  });
  const where = vi.fn((): Promise<void> => Promise.resolve());
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

      return {
        where: () => ({
          limit: (): Promise<(typeof MACI_ROW)[]> => Promise.resolve(options.maciRows ?? []),
        }),
      };
    },
  }));
  const transaction = vi.fn(async (work: (tx: { insert: typeof insert; update: typeof update }) => Promise<void>) =>
    work({ insert, update }),
  );

  return {
    db: { insert, update, select, transaction } as unknown as ConstructorParameters<typeof PostgresJobStore>[0],
    insert,
    jobInsertValues,
    stepInsertValues,
    maciInsertValues,
    maciOnConflict,
    set,
    update,
    transaction,
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

  test("succeed updates the job and upserts the MACI instance", async () => {
    const { db, transaction, update, set, maciInsertValues, maciOnConflict } = postgresDb();

    await new PostgresJobStore(db).succeed("job-1", 1_000_100, MACI);

    expect(transaction).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledWith(jobs);
    expect(set).toHaveBeenCalledWith({ status: "succeeded", completedAtMs: 1_000_100 });
    expect(maciInsertValues).toHaveBeenCalledWith({
      id: 1,
      ...MACI,
      jobId: "job-1",
    });
    expect(maciOnConflict).toHaveBeenCalledWith({
      target: maciInstances.id,
      set: { ...MACI, jobId: "job-1" },
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

  test("latest rejects an unknown job status", async () => {
    const { db } = postgresDb({
      jobRows: [{ ...JOB_ROW, status: "interrupted" }],
    });

    await expect(new PostgresJobStore(db).latest()).rejects.toThrow(/unknown job status interrupted/u);
  });

  test("currentMaci is undefined when no instance row exists", async () => {
    const { db } = postgresDb({ maciRows: [] });

    await expect(new PostgresJobStore(db).currentMaci()).resolves.toBeUndefined();
  });

  test("currentMaci returns the stored instance", async () => {
    const { db } = postgresDb({ maciRows: [MACI_ROW] });

    await expect(new PostgresJobStore(db).currentMaci()).resolves.toEqual(MACI);
  });
});
