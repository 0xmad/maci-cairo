import { describe, expect, test, vi } from "vitest";

import { jobs, jobSteps } from "../../jobs/job.schema.js";
import { createPollJobs } from "../../poll/poll.schema.js";
import { PostgresStandupStore } from "../postgresStandup.store.js";
import { standupCheckpoints, type StandupCheckpointRow } from "../standup.schema.js";
import { type MaciInstanceRecord } from "../standup.store.js";

const MACI: MaciInstanceRecord = {
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
  circuitProfile: "small",
  policy: "Free for all",
  voteBalanceAssigner: "Constant vote balance",
};

interface JobRow {
  id: string;
  kind: string;
  status: string;
  error: string | null;
  createdAtMs: number;
  completedAtMs: number;
}

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
  circuitProfile: MACI.circuitProfile,
  policy: MACI.policy,
  voteBalanceAssigner: MACI.voteBalanceAssigner,
  jobId: "job-1",
  network: "starknet_local",
  createdAtMs: 1_000_100,
};

function postgresDb(
  options: {
    insertError?: Error;
    updateError?: Error;
    jobRows?: JobRow[];
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
            limit: (): Promise<JobRow[]> => Promise.resolve(options.jobRows ?? []),
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

describe("PostgresStandupStore", () => {
  test("succeed updates the job and appends a MACI instance", async () => {
    const { db, transaction, update, set, maciInsertValues } = postgresDb();

    await new PostgresStandupStore(db).succeed("job-1", 1_000_100, MACI);

    expect(transaction).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledWith(jobs);
    expect(set).toHaveBeenCalledWith({ status: "succeeded", completedAtMs: 1_000_100 });
    expect(maciInsertValues).toHaveBeenCalledWith({
      ...MACI,
      jobId: "job-1",
      createdAtMs: 1_000_100,
    });
  });

  test("listMacis returns a page of address, network, and createdAtMs", async () => {
    const newer = { ...MACI_ROW, id: 2, maci: "0x22", jobId: "job-2" };
    const { db } = postgresDb({ maciRows: [MACI_ROW, newer] });

    await expect(new PostgresStandupStore(db).listMacis({ page: 1, pageSize: 1 })).resolves.toEqual({
      items: [{ address: "0x22", network: "starknet_local", createdAtMs: 1_000_100 }],
      total: 2,
    });
  });

  test("listMacis treats a missing count as zero", async () => {
    const { db } = postgresDb({ countRows: [] });

    await expect(new PostgresStandupStore(db).listMacis({ page: 1, pageSize: 10 })).resolves.toEqual({
      items: [],
      total: 0,
    });
  });

  test("readMaci returns the instance for an address", async () => {
    const { db } = postgresDb({ maciRows: [MACI_ROW] });

    await expect(new PostgresStandupStore(db).readMaci("0x7")).resolves.toEqual(MACI);
  });

  test("readMaci returns a sepolia instance", async () => {
    const { db } = postgresDb({ maciRows: [{ ...MACI_ROW, network: "sepolia" }] });

    await expect(new PostgresStandupStore(db).readMaci("0x7")).resolves.toEqual({ ...MACI, network: "sepolia" });
  });

  test("readMaci rejects an unknown network", async () => {
    const { db } = postgresDb({ maciRows: [{ ...MACI_ROW, network: "mainnet" }] });

    await expect(new PostgresStandupStore(db).readMaci("0x7")).rejects.toThrow(/unknown MACI network mainnet/u);
  });

  test("readMaci is undefined when no instance matches", async () => {
    const { db } = postgresDb({ maciRows: [] });

    await expect(new PostgresStandupStore(db).readMaci("0x7")).resolves.toBeUndefined();
  });

  test("readCheckpoint returns stored instance addresses", async () => {
    const { db } = postgresDb({
      checkpointRows: [
        {
          id: 1,
          leanImt: "0xaaa",
          checker: null,
          enforcer: null,
          assigner: null,
          maci: null,
        },
      ],
    });

    await expect(new PostgresStandupStore(db).readCheckpoint()).resolves.toEqual({ leanImt: "0xaaa" });
  });

  test("readCheckpoint is undefined when empty", async () => {
    const { db } = postgresDb({ checkpointRows: [] });

    await expect(new PostgresStandupStore(db).readCheckpoint()).resolves.toBeUndefined();
  });

  test("readCheckpoint is undefined when every instance address is blank", async () => {
    const { db } = postgresDb({
      checkpointRows: [
        {
          id: 1,
          leanImt: "",
          checker: null,
          enforcer: null,
          assigner: null,
          maci: null,
        },
      ],
    });

    await expect(new PostgresStandupStore(db).readCheckpoint()).resolves.toBeUndefined();
  });

  test("mergeCheckpoint upserts instance addresses", async () => {
    const { db, insert, checkpointInsertValues } = postgresDb();

    await new PostgresStandupStore(db).mergeCheckpoint({ leanImt: "0xaaa" });

    expect(insert).toHaveBeenCalledWith(standupCheckpoints);
    expect(checkpointInsertValues).toHaveBeenCalledWith({
      id: 1,
      leanImt: "0xaaa",
      checker: null,
      enforcer: null,
      assigner: null,
      maci: null,
    });
  });

  test("mergeCheckpoint writes nulls for omitted instance addresses", async () => {
    const { db, checkpointInsertValues } = postgresDb();

    await new PostgresStandupStore(db).mergeCheckpoint({});

    expect(checkpointInsertValues).toHaveBeenCalledWith({
      id: 1,
      leanImt: null,
      checker: null,
      enforcer: null,
      assigner: null,
      maci: null,
    });
  });

  test("mergeCheckpoint writes every instance address", async () => {
    const { db, checkpointInsertValues } = postgresDb();

    await new PostgresStandupStore(db).mergeCheckpoint({
      leanImt: "0xaaa",
      checker: "0xbbb",
      enforcer: "0xccc",
      assigner: "0xddd",
      maci: "0xeee",
    });

    expect(checkpointInsertValues).toHaveBeenCalledWith({
      id: 1,
      leanImt: "0xaaa",
      checker: "0xbbb",
      enforcer: "0xccc",
      assigner: "0xddd",
      maci: "0xeee",
    });
  });

  test("clearCheckpoint deletes the singleton row", async () => {
    const { db, remove } = postgresDb();

    await new PostgresStandupStore(db).clearCheckpoint();

    expect(remove).toHaveBeenCalledWith(standupCheckpoints);
  });
});
