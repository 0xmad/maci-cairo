import { intendedCoordinator, normalizeHex } from "maci-deploy/hex";
import { type DeployMaciResult, type MaciNetwork, type SncastOps } from "maci-deploy/maci";
import { describe, expect, test, vi } from "vitest";

import { jobs, jobSteps } from "../repositories/job.schema.js";
import { type JobStore } from "../repositories/job.store.js";
import { PostgresJobStore } from "../repositories/postgresJob.store.js";
import { StandupService, type JobEvent } from "../standup.service.js";

function padIndex(index: number): string {
  return normalizeHex(`0x${index.toString(16)}`);
}

function recordingOps(
  options: { failOn?: "set_target" | "coordinator"; coordinatorOnChain?: string } = {},
): SncastOps & { fieldCalls: string[][]; maciCoordinatorArg?: string } {
  let next = 1;
  const fieldCalls: string[][] = [];
  const ops: SncastOps & { fieldCalls: string[][]; maciCoordinatorArg?: string } = {
    fieldCalls,
    declareClass(): string {
      const classHash = padIndex(next);
      next += 1;
      return classHash;
    },
    deployUnique(_classHash: string, argumentsExpr?: string): string {
      const coordinator = argumentsExpr?.match(/coordinator: (0x[0-9a-f]+)/u)?.[1];

      if (coordinator !== undefined) {
        ops.maciCoordinatorArg = coordinator;
      }

      const address = padIndex(next);
      next += 1;
      return address;
    },
    field(_key: string, args: string[]): string {
      fieldCalls.push(args);

      if (args.includes("set_target") && options.failOn === "set_target") {
        throw new Error("set_target failed");
      }

      if (args[0] === "call" && args.includes("coordinator")) {
        if (options.failOn === "coordinator") {
          throw new Error("coordinator check failed");
        }

        return options.coordinatorOnChain ?? intendedCoordinator(undefined);
      }

      if (args[0] === "call" && args.includes("get_poll_factory")) {
        return padIndex(0xff);
      }

      return padIndex(next);
    },
  };

  return ops;
}

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
}

function postgresJobStore(): PostgresJobStore {
  const jobRows: JobRow[] = [];
  const stepRows: StepRow[] = [];
  let maciRow: MaciRow | undefined;

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
        network: row.network as MaciNetwork,
      };

      return Promise.resolve();
    },
  });
  const update = (): { set: (patch: Record<string, unknown>) => { where: () => Promise<void> } } => ({
    set: (patch: Record<string, unknown>): { where: () => Promise<void> } => ({
      where: (): Promise<void> => {
        const target = jobRows.find((job) => job.status === "running");

        if (target !== undefined) {
          Object.assign(target, patch);
        }

        return Promise.resolve();
      },
    }),
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

  return new PostgresJobStore({
    insert,
    update,
    select,
    transaction: (work: (tx: { insert: typeof insert; update: typeof update }) => Promise<void>) =>
      work({ insert, update }),
  } as unknown as ConstructorParameters<typeof PostgresJobStore>[0]);
}

function harness(ops: SncastOps = recordingOps(), store: JobStore = postgresJobStore()) {
  let n = 0;
  const service = new StandupService({
    store,
    sncast: ops,
    nowMs: (): number => 1_000_000,
    randomId: (): string => {
      n += 1;
      return `job-${n}`;
    },
  });

  return { service };
}

async function settle(service: StandupService): Promise<void> {
  await vi.waitFor(async () => {
    const job = await service.currentJob();
    expect(job?.status).not.toBe("running");
  });
}

describe("StandupService", () => {
  test("rejects a second start while MACI stand-up is running", async () => {
    const { service } = harness();

    const first = service.startStandUp();
    const second = service.startStandUp();

    await expect(first).resolves.toEqual({ jobId: "job-1" });
    await expect(second).rejects.toThrow(/^busy$/u);
    await expect(service.listMacis({ page: 1, pageSize: 10 })).resolves.toEqual({ items: [], total: 0 });
  });

  test("successful stand-up records a MACI instance with the server Coordinator and no Poll", async () => {
    const ops = recordingOps();
    const { service } = harness(ops);

    await expect(service.startStandUp()).resolves.toEqual({ jobId: "job-1" });
    await settle(service);

    const listed = await service.listMacis({ page: 1, pageSize: 10 });
    const job = await service.currentJob();

    expect(job?.status).toBe("succeeded");
    expect(listed.total).toBe(1);
    expect(listed.items[0]?.address).toMatch(/^0x/u);
    expect(listed.items[0]?.network).toBe("starknet_local");
    await expect(service.readMaci(listed.items[0]?.address ?? "")).resolves.toMatchObject({
      maci: listed.items[0]?.address,
      deployer: intendedCoordinator(undefined),
      network: "starknet_local",
    });
    expect(ops.fieldCalls.some((args) => args.includes("create_poll"))).toBe(false);
    expect(ops.maciCoordinatorArg).toBe(intendedCoordinator(undefined));
  });

  test("no instance is recorded when set_target fails", async () => {
    const { service } = harness(recordingOps({ failOn: "set_target" }));

    await service.startStandUp();
    await settle(service);

    const job = await service.currentJob();

    expect(job?.status).toBe("failed");
    expect(job?.error).toBe("set_target failed");
    expect(job?.steps.some((step) => step.name === "set_target")).toBe(false);
    await expect(service.listMacis({ page: 1, pageSize: 10 })).resolves.toEqual({ items: [], total: 0 });
  });

  test("no instance is recorded when the coordinator check fails", async () => {
    const { service } = harness(recordingOps({ failOn: "coordinator" }));

    await service.startStandUp();
    await settle(service);

    const job = await service.currentJob();

    expect(job?.status).toBe("failed");
    expect(job?.error).toBe("coordinator check failed");
    expect(job?.steps.some((step) => step.name === "set_target")).toBe(true);
    await expect(service.listMacis({ page: 1, pageSize: 10 })).resolves.toEqual({ items: [], total: 0 });
  });

  test("subscribe on a finished job emits completion without replaying steps", async () => {
    const { service } = harness();
    const events: JobEvent[] = [];

    await service.startStandUp();
    await settle(service);
    const unsub = await service.subscribe((event) => {
      events.push(event);
    });

    expect(events).toEqual([{ type: "completed", status: "succeeded" }]);
    unsub();
  });

  test("two Operators share one job: subscribe tails the same run and a second start is busy", async () => {
    const { service } = harness();
    const firstLog: JobEvent[] = [];
    const secondLog: JobEvent[] = [];

    await service.startStandUp();
    const unsubFirst = await service.subscribe((event) => {
      firstLog.push(event);
    });
    const unsubSecond = await service.subscribe((event) => {
      secondLog.push(event);
    });

    await expect(service.startStandUp()).rejects.toThrow(/^busy$/u);
    await settle(service);

    expect(firstLog.at(-1)).toEqual({ type: "completed", status: "succeeded" });
    expect(secondLog.at(-1)).toEqual({ type: "completed", status: "succeeded" });
    expect(firstLog.filter((event) => event.type === "step")).toHaveLength(
      secondLog.filter((event) => event.type === "step").length,
    );
    unsubFirst();
    unsubSecond();
  });

  test("subscribe mid-job does not double-count a step that is then emitted live", async () => {
    const store = postgresJobStore();
    const recorded = store.appendStep.bind(store);
    const events: JobEvent[] = [];
    let service: StandupService | undefined;

    store.appendStep = (jobId, step): Promise<void> =>
      recorded(jobId, step).then(async () => {
        if (step.seq === 1 && service !== undefined) {
          await service.subscribe((event) => {
            events.push(event);
          });
        }
      });

    let n = 0;
    service = new StandupService({
      store,
      sncast: recordingOps(),
      nowMs: (): number => 1_000_000,
      randomId: (): string => {
        n += 1;
        return `job-${n}`;
      },
    });

    await service.startStandUp();
    await settle(service);

    const steps = events.filter((event) => event.type === "step");
    expect(steps).toHaveLength(8);
    expect(new Set(steps.map((event) => event.step.seq)).size).toBe(8);
    expect(events.at(-1)).toEqual({ type: "completed", status: "succeeded" });
  });

  test("store failure while finishing the job does not reject startStandUp", async () => {
    const store = postgresJobStore();
    store.fail = (): Promise<void> => Promise.reject(new Error("db down"));
    let n = 0;
    const service = new StandupService({
      store,
      sncast: recordingOps({ failOn: "set_target" }),
      nowMs: (): number => 1_000_000,
      randomId: (): string => {
        n += 1;
        return `job-${n}`;
      },
    });

    await expect(service.startStandUp()).resolves.toEqual({ jobId: "job-1" });
    await vi.waitFor(async () => {
      const job = await service.currentJob();
      expect(job?.status).toBe("running");
      expect(job?.steps.some((step) => step.name === "leanImt")).toBe(true);
    });
  });

  test("subscribe with no job attaches a live tail", async () => {
    const { service } = harness();
    const events: JobEvent[] = [];
    const unsub = await service.subscribe((event) => {
      events.push(event);
    });

    expect(events).toEqual([]);

    await service.startStandUp();
    await settle(service);

    expect(events.at(-1)).toEqual({ type: "completed", status: "succeeded" });
    unsub();
  });

  test("subscribe on a running job does not replay stored declare steps", async () => {
    const store: JobStore = {
      tryBegin: () => Promise.resolve(true),
      appendStep: () => Promise.resolve(),
      succeed: () => Promise.resolve(),
      fail: () => Promise.resolve(),
      latest: () =>
        Promise.resolve({
          id: "job-1",
          kind: "standup",
          status: "running",
          steps: [
            { seq: 1, kind: "declare", name: "LeanIMT" },
            { seq: 2, kind: "deploy", name: "leanImt" },
          ],
        }),
      listMacis: () => Promise.resolve({ items: [], total: 0 }),
      readMaci: () => Promise.resolve(undefined),
    };
    const { service } = harness(recordingOps(), store);
    const events: JobEvent[] = [];

    const unsub = await service.subscribe((event) => {
      events.push(event);
    });

    expect(events).toEqual([{ type: "step", step: { seq: 2, kind: "deploy", name: "leanImt" } }]);
    unsub();
  });

  test("subscribe does not emit declare steps", async () => {
    const { service } = harness();
    const events: JobEvent[] = [];
    const unsub = await service.subscribe((event) => {
      events.push(event);
    });

    await service.startStandUp();
    await settle(service);

    const steps = events.filter((event) => event.type === "step");
    expect(steps.map((event) => event.step.kind)).toEqual([
      "deploy",
      "deploy",
      "deploy",
      "deploy",
      "deploy",
      "invoke",
      "call",
      "call",
    ]);
    unsub();
  });

  test("subscribe replays a failed job's completion", async () => {
    const { service } = harness(recordingOps({ failOn: "set_target" }));
    const events: JobEvent[] = [];

    await service.startStandUp();
    await settle(service);
    await service.subscribe((event) => {
      events.push(event);
    });

    expect(events.at(-1)).toEqual({ type: "completed", status: "failed", error: "set_target failed" });
    expect(events.filter((event) => event.type === "step")).toEqual([]);
  });

  test("a non-Error throw from sncast fails the job as failed", async () => {
    const ops = recordingOps();
    ops.declareClass = (): string => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- catch must map non-Errors to "failed"
      throw "boom";
    };
    const { service } = harness(ops);

    await service.startStandUp();
    await settle(service);

    await expect(service.currentJob()).resolves.toMatchObject({ status: "failed", error: "failed" });
    await expect(service.listMacis({ page: 1, pageSize: 10 })).resolves.toEqual({ items: [], total: 0 });
  });
});
