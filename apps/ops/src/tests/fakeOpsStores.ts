import { type DeployMaciResult, type MaciNetwork } from "maci-deploy/maci";

import { jobs, jobSteps } from "../jobs/job.schema.js";
import { type JobStore } from "../jobs/job.store.js";
import { PostgresJobStore } from "../jobs/postgresJob.store.js";
import { createPollJobs, polls } from "../poll/poll.schema.js";
import { type CreatePollJob, type PollStore } from "../poll/poll.store.js";
import { PostgresPollStore } from "../poll/postgresPoll.store.js";
import { PostgresStandupStore } from "../standup/postgresStandup.store.js";
import { standupCheckpoints, type StandupCheckpointRow } from "../standup/standup.schema.js";
import { type StandupStore } from "../standup/standup.store.js";

interface JobRow {
  id: string;
  kind: string;
  status: string;
  error: string | null;
  createdAtMs: number;
  completedAtMs: number | null;
}

interface StepRow {
  jobId: string;
  seq: number;
  kind: string;
  name: string;
}

interface MaciRow extends DeployMaciResult {
  id: number;
  jobId: string;
  circuitProfile: string;
  policy: string;
  voteBalanceAssigner: string;
  createdAtMs: number;
}

export interface OpsStores {
  jobs: JobStore;
  standup: StandupStore;
  polls: PollStore;
}

/** In-memory Drizzle stand-in shared by stand-up, poll, and job tests. */
export function fakeOpsStores(): OpsStores {
  const jobRows: JobRow[] = [];
  const stepRows: StepRow[] = [];
  let maciRow: MaciRow | undefined;
  let checkpointRow: StandupCheckpointRow | undefined;
  let createPollRow: (CreatePollJob & { jobId: string }) | undefined;
  const pollRows: {
    id: number;
    maci: string;
    address: string;
    pollId: string;
    startDate: string;
    endDate: string;
    pollPublicKeyX: string;
    pollPublicKeyY: string;
    createdAtMs: number;
  }[] = [];

  const insert = (table: unknown): { values: (row: Record<string, unknown>) => unknown } => ({
    values: (row: Record<string, unknown>): unknown => {
      if (table === jobs) {
        if (jobRows.some((job) => job.status === "running")) {
          return Promise.reject(Object.assign(new Error("duplicate"), { code: "23505" }));
        }

        jobRows.push({
          id: row.id as string,
          kind: row.kind as string,
          status: row.status as string,
          error: null,
          createdAtMs: row.createdAtMs as number,
          completedAtMs: null,
        });

        return Promise.resolve();
      }

      if (table === jobSteps) {
        stepRows.push({
          jobId: row.jobId as string,
          seq: row.seq as number,
          kind: row.kind as string,
          name: row.name as string,
        });

        return Promise.resolve();
      }

      if (table === standupCheckpoints) {
        checkpointRow = {
          id: 1,
          leanImt: (row.leanImt as string | null | undefined) ?? null,
          checker: (row.checker as string | null | undefined) ?? null,
          enforcer: (row.enforcer as string | null | undefined) ?? null,
          assigner: (row.assigner as string | null | undefined) ?? null,
          maci: (row.maci as string | null | undefined) ?? null,
        };

        return {
          onConflictDoUpdate: (): Promise<void> => Promise.resolve(),
        };
      }

      if (table === createPollJobs) {
        createPollRow = {
          jobId: row.jobId as string,
          maci: row.maci as string,
          startDate: row.startDate as string,
          endDate: row.endDate as string,
          pollPublicKeyX: row.pollPublicKeyX as string,
          pollPublicKeyY: row.pollPublicKeyY as string,
          ...(typeof row.pollId === "string" && row.pollId.length > 0 ? { pollId: row.pollId } : {}),
        };

        return {
          onConflictDoUpdate: (): Promise<void> => Promise.resolve(),
        };
      }

      if (table === polls) {
        pollRows.push({
          id: pollRows.length + 1,
          maci: row.maci as string,
          address: row.address as string,
          pollId: row.pollId as string,
          startDate: row.startDate as string,
          endDate: row.endDate as string,
          pollPublicKeyX: row.pollPublicKeyX as string,
          pollPublicKeyY: row.pollPublicKeyY as string,
          createdAtMs: row.createdAtMs as number,
        });

        return Promise.resolve();
      }

      const previous = maciRow;

      maciRow = {
        id: (previous?.id ?? 0) + 1,
        jobId: row.jobId as string,
        leanImt: row.leanImt as string,
        checker: row.checker as string,
        enforcer: row.enforcer as string,
        assigner: row.assigner as string,
        pollClassHash: row.pollClassHash as string,
        pollFactoryClassHash: row.pollFactoryClassHash as string,
        maci: row.maci as string,
        pollFactory: row.pollFactory as string,
        coordinator: row.coordinator as string,
        deployer: row.deployer as string,
        circuitProfile: row.circuitProfile as string,
        policy: row.policy as string,
        voteBalanceAssigner: row.voteBalanceAssigner as string,
        network: row.network as MaciNetwork,
        createdAtMs: row.createdAtMs as number,
      };

      return Promise.resolve();
    },
  });

  const update = (): { set: (patch: Record<string, unknown>) => { where: () => Promise<void> } } => ({
    set: (patch: Record<string, unknown>): { where: () => Promise<void> } => ({
      where: (): Promise<void> => {
        const running = jobRows.find((job) => job.status === "running");
        const latest = [...jobRows].sort((left, right) => right.createdAtMs - left.createdAtMs).at(0);
        const target = running ?? latest;

        if (target !== undefined) {
          Object.assign(target, patch);
        }

        return Promise.resolve();
      },
    }),
  });

  const remove = (): { where: () => Promise<void> } => ({
    where: (): Promise<void> => {
      checkpointRow = undefined;

      return Promise.resolve();
    },
  });

  const select = (): { from: (table: unknown) => unknown } => ({
    from: (table: unknown): unknown => {
      if (table === jobs) {
        return {
          orderBy: (): { limit: (count: number) => Promise<JobRow[]> } => ({
            limit: (count: number): Promise<JobRow[]> =>
              Promise.resolve([...jobRows].sort((left, right) => right.createdAtMs - left.createdAtMs).slice(0, count)),
          }),
        };
      }

      if (table === jobSteps) {
        return {
          where: (): { orderBy: () => Promise<StepRow[]> } => ({
            orderBy: (): Promise<StepRow[]> => {
              const latest = [...jobRows].sort((left, right) => right.createdAtMs - left.createdAtMs)[0];

              return Promise.resolve(
                stepRows.filter((step) => step.jobId === latest.id).sort((left, right) => left.seq - right.seq),
              );
            },
          }),
        };
      }

      if (table === standupCheckpoints) {
        return {
          where: (): { limit: () => Promise<NonNullable<typeof checkpointRow>[]> } => ({
            limit: (): Promise<NonNullable<typeof checkpointRow>[]> =>
              Promise.resolve(checkpointRow === undefined ? [] : [checkpointRow]),
          }),
        };
      }

      if (table === createPollJobs) {
        return {
          where: (): { limit: () => Promise<NonNullable<typeof createPollRow>[]> } => ({
            limit: (): Promise<NonNullable<typeof createPollRow>[]> =>
              Promise.resolve(createPollRow === undefined ? [] : [createPollRow]),
          }),
        };
      }

      if (table === polls) {
        const listed = [...pollRows].sort((left, right) => right.id - left.id);

        return {
          where: (): unknown => ({
            then: (resolve: (value: { total: number }[]) => unknown) =>
              Promise.resolve([{ total: listed.length }]).then(resolve),
            orderBy: (): {
              limit: (take: number) => Promise<(typeof pollRows)[number][]> & {
                offset: (skip: number) => Promise<(typeof pollRows)[number][]>;
              };
            } => ({
              limit: (take: number) =>
                Object.assign(Promise.resolve(listed.slice(0, take)), {
                  offset: (skip: number): Promise<(typeof pollRows)[number][]> =>
                    Promise.resolve(listed.slice(skip, skip + take)),
                }),
            }),
          }),
        };
      }

      const rows = maciRow === undefined ? [] : [maciRow];

      return {
        then: (resolve: (value: { total: number }[]) => unknown) =>
          Promise.resolve([{ total: rows.length }]).then(resolve),
        where: (): { limit: () => Promise<NonNullable<typeof maciRow>[]> } => ({
          limit: (): Promise<NonNullable<typeof maciRow>[]> => Promise.resolve(rows),
        }),
        orderBy: (): {
          limit: (take: number) => Promise<NonNullable<typeof maciRow>[]> & {
            offset: (skip: number) => Promise<NonNullable<typeof maciRow>[]>;
          };
        } => ({
          limit: (take: number) =>
            Object.assign(Promise.resolve(rows.slice(0, take)), {
              offset: (skip: number): Promise<NonNullable<typeof maciRow>[]> =>
                Promise.resolve(rows.slice(skip, skip + take)),
            }),
        }),
      };
    },
  });

  const db = {
    insert,
    update,
    select,
    delete: remove,
    transaction: (
      work: (tx: { insert: typeof insert; update: typeof update; delete: typeof remove }) => Promise<void>,
    ) => work({ insert, update, delete: remove }),
  } as never;

  return {
    jobs: new PostgresJobStore(db),
    standup: new PostgresStandupStore(db),
    polls: new PostgresPollStore(db),
  };
}

export function jobClock(): { nowMs: () => number; randomId: () => string } {
  let n = 0;
  let nowMs = 1_000_000;

  return {
    nowMs: (): number => {
      nowMs += 1;

      return nowMs;
    },
    randomId: (): string => {
      n += 1;

      return `job-${n}`;
    },
  };
}
