import { type DeployMaciResult } from "maci-deploy/maci";
import { describe, expect, test, vi } from "vitest";

import { jobs, jobSteps } from "../repositories/job.schema.js";
import { type JobStep } from "../repositories/job.store.js";
import { PostgresJobStore } from "../repositories/postgresJob.store.js";

const MACI: DeployMaciResult = {
  leanImt: "0x1",
  checker: "0x2",
  enforcer: "0x3",
  assigner: "0x4",
  pollClassHash: "0x5",
  pollFactoryClassHash: "0x6",
  maci: "0x7",
  pollFactory: "0x8",
  coordinator: "0x9",
  deployer: "0xa",
  network: "starknet_local",
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
  deployer: MACI.deployer,
  jobId: "job-1",
  network: "starknet_local",
  createdAtMs: 1_000_100,
};

function postgresDb(
  options: {
    insertError?: Error;
    jobRows?: (typeof JOB_ROW)[];
    stepRows?: { jobId: string; seq: number; kind: string; name: string }[];
    maciRows?: (typeof MACI_ROW)[];
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
        then: (resolve: (rows: { total?: number }[]) => unknown) =>
          Promise.resolve(options.countRows ?? [{ total: (options.maciRows ?? []).length }]).then(resolve),
        where: () => ({
          limit: (): Promise<(typeof MACI_ROW)[]> => Promise.resolve(options.maciRows ?? []),
        }),
        orderBy: () => ({
          limit: (take: number) => {
            const rows = [...(options.maciRows ?? [])].sort((left, right) => right.id - left.id);

            return Object.assign(Promise.resolve(rows.slice(0, take)), {
              offset: (skip: number): Promise<(typeof MACI_ROW)[]> => Promise.resolve(rows.slice(skip, skip + take)),
            });
          },
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

  test("succeed updates the job and appends a MACI instance", async () => {
    const { db, transaction, update, set, maciInsertValues } = postgresDb();

    await new PostgresJobStore(db).succeed("job-1", 1_000_100, MACI);

    expect(transaction).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledWith(jobs);
    expect(set).toHaveBeenCalledWith({ status: "succeeded", completedAtMs: 1_000_100 });
    expect(maciInsertValues).toHaveBeenCalledWith({
      ...MACI,
      jobId: "job-1",
      createdAtMs: 1_000_100,
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

  test("listMacis returns a page of address and network", async () => {
    const newer = { ...MACI_ROW, id: 2, maci: "0x22", jobId: "job-2" };
    const { db } = postgresDb({ maciRows: [MACI_ROW, newer] });

    await expect(new PostgresJobStore(db).listMacis({ page: 1, pageSize: 1 })).resolves.toEqual({
      items: [{ address: "0x22", network: "starknet_local" }],
      total: 2,
    });
  });

  test("listMacis treats a missing count as zero", async () => {
    const { db } = postgresDb({ countRows: [] });

    await expect(new PostgresJobStore(db).listMacis({ page: 1, pageSize: 10 })).resolves.toEqual({
      items: [],
      total: 0,
    });
  });

  test("readMaci returns the instance for an address", async () => {
    const { db } = postgresDb({ maciRows: [MACI_ROW] });

    await expect(new PostgresJobStore(db).readMaci("0x7")).resolves.toEqual(MACI);
  });

  test("readMaci returns a sepolia instance", async () => {
    const { db } = postgresDb({ maciRows: [{ ...MACI_ROW, network: "sepolia" }] });

    await expect(new PostgresJobStore(db).readMaci("0x7")).resolves.toEqual({ ...MACI, network: "sepolia" });
  });

  test("readMaci rejects an unknown network", async () => {
    const { db } = postgresDb({ maciRows: [{ ...MACI_ROW, network: "mainnet" }] });

    await expect(new PostgresJobStore(db).readMaci("0x7")).rejects.toThrow(/unknown MACI network mainnet/u);
  });

  test("readMaci is undefined when no instance matches", async () => {
    const { db } = postgresDb({ maciRows: [] });

    await expect(new PostgresJobStore(db).readMaci("0x7")).resolves.toBeUndefined();
  });
});
