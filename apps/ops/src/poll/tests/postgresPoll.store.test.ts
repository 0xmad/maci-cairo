import { describe, expect, test, vi } from "vitest";

import { jobs, jobSteps } from "../../jobs/job.schema.js";
import { standupCheckpoints, type StandupCheckpointRow } from "../../standup/standup.schema.js";
import { createPollJobs, polls } from "../poll.schema.js";
import { PostgresPollStore } from "../postgresPoll.store.js";

interface JobRow {
  id: string;
  kind: string;
  status: string;
  error: string | null;
  createdAtMs: number;
  completedAtMs: number | null;
}

interface MaciRow {
  id: number;
  leanImt: string;
  checker: string;
  enforcer: string;
  assigner: string;
  pollClassHash: string;
  pollFactoryClassHash: string;
  maci: string;
  pollFactory: string;
  coordinator: string;
  deployer: string;
  circuitProfile: string;
  policy: string;
  voteBalanceAssigner: string;
  jobId: string;
  network: string;
  createdAtMs: number;
}

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
    pollRows?: {
      id: number;
      maci: string;
      address: string;
      pollId: string;
      startDate: string;
      endDate: string;
      pollPublicKeyX: string;
      pollPublicKeyY: string;
      createdAtMs: number;
    }[];
    pollCountRows?: { total?: number }[];
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
  const pollInsertValues = vi.fn((): Promise<void> => Promise.resolve());
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

    if (table === polls) {
      return { values: pollInsertValues };
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

      if (table === polls) {
        const listed = [...(options.pollRows ?? [])].sort((left, right) => right.id - left.id);

        return {
          where: () => ({
            then: (resolve: (rows: { total?: number }[]) => unknown) =>
              Promise.resolve(options.pollCountRows ?? [{ total: listed.length }]).then(resolve),
            orderBy: () => ({
              limit: (take: number) =>
                Object.assign(Promise.resolve(listed.slice(0, take)), {
                  offset: (skip: number): Promise<typeof listed> => Promise.resolve(listed.slice(skip, skip + take)),
                }),
            }),
            limit: (): Promise<typeof listed> => Promise.resolve(listed.slice(0, 1)),
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
    pollInsertValues,
    set,
    update,
    transaction,
    remove,
  };
}

describe("PostgresPollStore", () => {
  test("writeCreatePoll upserts the frozen attempt", async () => {
    const { db, insert, createPollInsertValues } = postgresDb();

    await new PostgresPollStore(db).writeCreatePoll("job-1", {
      maci: "0x7",
      startDate: "0",
      endDate: "1000",
      pollPublicKeyX: "0",
      pollPublicKeyY: "1",
      pollId: "2",
    });

    expect(insert).toHaveBeenCalledWith(createPollJobs);
    expect(createPollInsertValues).toHaveBeenCalledWith({
      jobId: "job-1",
      maci: "0x7",
      startDate: "0",
      endDate: "1000",
      pollPublicKeyX: "0",
      pollPublicKeyY: "1",
      pollId: "2",
    });
  });

  test("readCreatePoll returns the stored attempt", async () => {
    const { db } = postgresDb({
      createPollRows: [
        {
          jobId: "job-1",
          maci: "0x7",
          startDate: "0",
          endDate: "1000",
          pollPublicKeyX: "0",
          pollPublicKeyY: "1",
          pollId: "2",
        },
      ],
    });

    await expect(new PostgresPollStore(db).readCreatePoll("job-1")).resolves.toEqual({
      maci: "0x7",
      startDate: "0",
      endDate: "1000",
      pollPublicKeyX: "0",
      pollPublicKeyY: "1",
      pollId: "2",
    });
  });

  test("readCreatePoll omits a missing poll id", async () => {
    const { db } = postgresDb({
      createPollRows: [
        {
          jobId: "job-1",
          maci: "0x7",
          startDate: "0",
          endDate: "1000",
          pollPublicKeyX: "0",
          pollPublicKeyY: "1",
          pollId: null,
        },
      ],
    });

    await expect(new PostgresPollStore(db).readCreatePoll("job-1")).resolves.toEqual({
      maci: "0x7",
      startDate: "0",
      endDate: "1000",
      pollPublicKeyX: "0",
      pollPublicKeyY: "1",
    });
  });

  test("readCreatePoll is undefined when no row matches", async () => {
    const { db } = postgresDb({ createPollRows: [] });

    await expect(new PostgresPollStore(db).readCreatePoll("job-1")).resolves.toBeUndefined();
  });

  test("recordPoll inserts a Poll list row", async () => {
    const { db, insert, pollInsertValues } = postgresDb();

    await new PostgresPollStore(db).recordPoll({
      maci: "0x7",
      address: "0xaa",
      pollId: "2",
      startDate: "0",
      endDate: "1000",
      pollPublicKey: ["0", "1"],
      createdAtMs: 1_000_200,
    });

    expect(insert).toHaveBeenCalledWith(polls);
    expect(pollInsertValues).toHaveBeenCalledWith({
      maci: "0x7",
      address: "0xaa",
      pollId: "2",
      startDate: "0",
      endDate: "1000",
      pollPublicKeyX: "0",
      pollPublicKeyY: "1",
      createdAtMs: 1_000_200,
    });
  });

  test("listPolls returns recorded Polls newest first", async () => {
    const { db } = postgresDb({
      pollRows: [
        {
          id: 1,
          maci: "0x7",
          address: "0xaa",
          pollId: "1",
          startDate: "0",
          endDate: "1000",
          pollPublicKeyX: "0",
          pollPublicKeyY: "1",
          createdAtMs: 1_000_100,
        },
        {
          id: 2,
          maci: "0x7",
          address: "0xbb",
          pollId: "2",
          startDate: "10",
          endDate: "20",
          pollPublicKeyX: "3",
          pollPublicKeyY: "4",
          createdAtMs: 1_000_200,
        },
      ],
    });

    await expect(new PostgresPollStore(db).listPolls("0x7", { page: 1, pageSize: 10 })).resolves.toEqual({
      total: 2,
      items: [
        {
          address: "0xbb",
          pollId: "2",
          startDate: "10",
          endDate: "20",
          pollPublicKey: ["3", "4"],
          createdAtMs: 1_000_200,
        },
        {
          address: "0xaa",
          pollId: "1",
          startDate: "0",
          endDate: "1000",
          pollPublicKey: ["0", "1"],
          createdAtMs: 1_000_100,
        },
      ],
    });
  });

  test("listPolls totals zero when the count query returns no rows", async () => {
    const { db } = postgresDb({
      pollCountRows: [],
      pollRows: [
        {
          id: 1,
          maci: "0x7",
          address: "0xaa",
          pollId: "1",
          startDate: "0",
          endDate: "1000",
          pollPublicKeyX: "0",
          pollPublicKeyY: "1",
          createdAtMs: 1_000_100,
        },
      ],
    });

    await expect(new PostgresPollStore(db).listPolls("0x7", { page: 1, pageSize: 10 })).resolves.toEqual({
      total: 0,
      items: [
        {
          address: "0xaa",
          pollId: "1",
          startDate: "0",
          endDate: "1000",
          pollPublicKey: ["0", "1"],
          createdAtMs: 1_000_100,
        },
      ],
    });
  });

  test("readPoll returns the recorded Poll", async () => {
    const { db } = postgresDb({
      pollRows: [
        {
          id: 1,
          maci: "0x7",
          address: "0xaa",
          pollId: "2",
          startDate: "0",
          endDate: "1000",
          pollPublicKeyX: "0",
          pollPublicKeyY: "1",
          createdAtMs: 1_000_200,
        },
      ],
    });

    await expect(new PostgresPollStore(db).readPoll("0xaa")).resolves.toEqual({
      address: "0xaa",
      pollId: "2",
      startDate: "0",
      endDate: "1000",
      pollPublicKey: ["0", "1"],
      createdAtMs: 1_000_200,
      maci: "0x7",
    });
  });

  test("readPoll is undefined when no Poll matches", async () => {
    const { db } = postgresDb();

    await expect(new PostgresPollStore(db).readPoll("0xaa")).resolves.toBeUndefined();
  });
});
