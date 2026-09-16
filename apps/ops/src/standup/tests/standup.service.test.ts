import { intendedCoordinator } from "maci-deploy/hex";
import { SMALL_STANDUP_INTENT } from "maci-deploy/intent";
import { type SncastOps } from "maci-deploy/maci";
import { describe, expect, test, vi } from "vitest";

import { JobEvents } from "../../jobs/job.events.js";
import { type JobStore } from "../../jobs/job.store.js";
import { fakeOpsStores, jobClock } from "../../tests/fakeOpsStores.js";
import { recordingOps } from "../../tests/sncastFixtures.js";
import { StandupService, type JobEvent } from "../standup.service.js";
import { type StandupStore } from "../standup.store.js";

function idleJobs(overrides: Partial<JobStore> = {}): JobStore {
  return {
    tryBegin: () => Promise.resolve(true),
    appendStep: () => Promise.resolve(),
    markSucceeded: () => Promise.resolve(),
    fail: () => Promise.resolve(),
    interruptRunning: () => Promise.resolve(),
    tryResume: () => Promise.resolve(false),
    latest: () => Promise.resolve(undefined),
    ...overrides,
  };
}

function idleStandup(overrides: Partial<StandupStore> = {}): StandupStore {
  return {
    succeed: () => Promise.resolve(),
    mergeCheckpoint: () => Promise.resolve(),
    readCheckpoint: () => Promise.resolve(undefined),
    clearCheckpoint: () => Promise.resolve(),
    listMacis: () => Promise.resolve({ items: [], total: 0 }),
    readMaci: () => Promise.resolve(undefined),
    ...overrides,
  };
}

function harness(
  ops: SncastOps = recordingOps(),
  stores: { jobs: JobStore; standup: StandupStore } = fakeOpsStores(),
  clock: { nowMs: () => number; randomId: () => string } = jobClock(),
  extra: { scheduleWork?: (work: () => void) => void } = {},
) {
  const events = new JobEvents();
  const service = new StandupService({
    jobs: stores.jobs,
    standup: stores.standup,
    events,
    sncast: ops,
    nowMs: clock.nowMs,
    randomId: clock.randomId,
    ...extra,
  });

  return { service, events, stores };
}

async function settle(service: StandupService): Promise<void> {
  await vi.waitFor(async () => {
    const job = await service.currentJob();
    expect(job?.status).not.toBe("running");
  });
}

describe("StandupService", () => {
  test("catalog lists small Circuit profile capacity, Free for all Policy, and Constant vote balance", () => {
    const { service } = harness();
    const catalog = service.readStandUpCatalog();
    const serialized = JSON.stringify(catalog);

    expect(catalog).toEqual({
      circuitProfiles: [{ id: "small", maxSignups: 32, maxVoteOptions: 5 }],
      policies: [{ id: "Free for all" }],
      assigners: [{ id: "Constant vote balance" }],
    });
    expect(serialized).not.toMatch(/checker/iu);
    expect(serialized).not.toMatch(/enforcer/iu);
  });

  test("rejects an unknown Circuit profile without starting a job", async () => {
    const { service } = harness();

    await expect(service.startStandUp({ ...SMALL_STANDUP_INTENT, circuitProfile: "medium" })).rejects.toThrow(
      /^unknown circuit profile: medium$/u,
    );
    await expect(service.currentJob()).resolves.toBeUndefined();
  });

  test("rejects an unknown Policy without starting a job", async () => {
    const { service } = harness();

    await expect(service.startStandUp({ ...SMALL_STANDUP_INTENT, policy: "Allowlist" })).rejects.toThrow(
      /^unknown policy: Allowlist$/u,
    );
    await expect(service.currentJob()).resolves.toBeUndefined();
  });

  test("rejects an unknown assigner without starting a job", async () => {
    const { service } = harness();

    await expect(service.startStandUp({ ...SMALL_STANDUP_INTENT, assigner: "Token gate" })).rejects.toThrow(
      /^unknown assigner: Token gate$/u,
    );
    await expect(service.currentJob()).resolves.toBeUndefined();
  });

  test("rejects a zero constant vote balance without starting a job", async () => {
    const { service } = harness();

    await expect(service.startStandUp({ ...SMALL_STANDUP_INTENT, constantVoteBalance: 0n })).rejects.toThrow(
      /^Zero vote balance$/u,
    );
    await expect(service.currentJob()).resolves.toBeUndefined();
  });

  test("rejects a constant vote balance at 2^251 without starting a job", async () => {
    const { service } = harness();

    await expect(service.startStandUp({ ...SMALL_STANDUP_INTENT, constantVoteBalance: 2n ** 251n })).rejects.toThrow(
      /^Vote balance too large$/u,
    );
    await expect(service.currentJob()).resolves.toBeUndefined();
  });

  test("rejects a second start while MACI stand-up is running", async () => {
    const { service } = harness();

    const first = service.startStandUp(SMALL_STANDUP_INTENT);
    const second = service.startStandUp(SMALL_STANDUP_INTENT);

    await expect(first).resolves.toEqual({ jobId: "job-1" });
    await expect(second).rejects.toThrow(/^busy$/u);
    await expect(service.listMacis({ page: 1, pageSize: 10 })).resolves.toEqual({ items: [], total: 0 });
  });

  test("successful stand-up records a MACI instance with the server Coordinator and no Poll", async () => {
    const ops = recordingOps();
    const { service } = harness(ops);

    await expect(service.startStandUp(SMALL_STANDUP_INTENT)).resolves.toEqual({ jobId: "job-1" });
    await settle(service);

    const listed = await service.listMacis({ page: 1, pageSize: 10 });
    const job = await service.currentJob();

    expect(job?.status).toBe("succeeded");
    expect(listed.total).toBe(1);
    expect(listed.items[0]?.address).toMatch(/^0x/u);
    expect(listed.items[0]?.network).toBe("starknet_local");
    expect(listed.items[0]?.createdAtMs).toBeGreaterThan(1_000_000);
    await expect(service.readMaci(listed.items[0]?.address ?? "")).resolves.toMatchObject({
      maci: listed.items[0]?.address,
      deployer: intendedCoordinator(undefined),
      network: "starknet_local",
      circuitProfile: "small",
      policy: "Free for all",
      voteBalanceAssigner: "Constant vote balance",
    });
    await expect(service.currentMaciInstance()).resolves.toMatchObject({ maci: listed.items[0]?.address });
    expect(ops.fieldCalls.some((args) => args.includes("create_poll"))).toBe(false);
    expect(ops.maciCoordinatorArg).toBe(intendedCoordinator(undefined));
    expect(ops.assignerArg).toBe("3");
  });

  test("current MACI is undefined before any stand-up", async () => {
    const { service } = harness();

    await expect(service.currentMaciInstance()).resolves.toBeUndefined();
  });

  test("omitted constant vote balance deploys amount 3", async () => {
    const ops = recordingOps();
    const { service } = harness(ops);

    await service.startStandUp(SMALL_STANDUP_INTENT);
    await settle(service);

    expect(ops.assignerArg).toBe("3");
  });

  test("constant vote balance 7 is deployed as the assigner amount", async () => {
    const ops = recordingOps();
    const { service } = harness(ops);

    await service.startStandUp({ ...SMALL_STANDUP_INTENT, constantVoteBalance: 7n });
    await settle(service);

    expect(ops.assignerArg).toBe("7");
  });

  test("failing deploy N then starting again skips earlier deploys and records no MACI until completion", async () => {
    const stores = fakeOpsStores();
    const clock = jobClock();
    const firstOps = recordingOps({ failOnDeploy: 2 });
    const { service } = harness(firstOps, stores, clock);

    await service.startStandUp(SMALL_STANDUP_INTENT);
    await settle(service);

    const failed = await service.currentJob();
    const leanImt = firstOps.deploys[0];

    expect(failed?.status).toBe("failed");
    expect(failed?.error).toBe("deploy failed");
    expect(failed?.steps.some((step) => step.name === "leanImt")).toBe(true);
    await expect(service.hasIncompleteStandUp()).resolves.toBe(true);
    await expect(service.listMacis({ page: 1, pageSize: 10 })).resolves.toEqual({ items: [], total: 0 });

    const resumeOps = recordingOps();
    const { service: resume } = harness(resumeOps, stores, clock);

    await expect(resume.startStandUp(SMALL_STANDUP_INTENT)).resolves.toEqual({ jobId: failed?.id });
    await settle(resume);

    expect(resumeOps.deploys).toHaveLength(4);
    expect(resumeOps.deploys).not.toContain(leanImt);
    expect(resumeOps.declares).toEqual([
      "LeanIMT",
      "FreeForAllChecker",
      "FreeForAllEnforcer",
      "ConstantInitialVoteBalance",
      "Poll",
      "PollFactory",
      "MACI",
    ]);
    expect((await resume.currentJob())?.status).toBe("succeeded");
    await expect(resume.hasIncompleteStandUp()).resolves.toBe(false);
    await expect(resume.listMacis({ page: 1, pageSize: 10 })).resolves.toMatchObject({ total: 1 });
  });

  test("discard when idle drops the checkpoint so the next start deploys from the beginning", async () => {
    const stores = fakeOpsStores();
    const clock = jobClock();
    const { service } = harness(recordingOps({ failOnDeploy: 2 }), stores, clock);

    await service.startStandUp(SMALL_STANDUP_INTENT);
    await settle(service);

    await expect(service.hasIncompleteStandUp()).resolves.toBe(true);
    await service.discardStandUp();
    await expect(service.hasIncompleteStandUp()).resolves.toBe(false);
    await expect(service.listMacis({ page: 1, pageSize: 10 })).resolves.toEqual({ items: [], total: 0 });

    const freshOps = recordingOps();
    const { service: fresh } = harness(freshOps, stores, clock);

    await fresh.startStandUp(SMALL_STANDUP_INTENT);
    await settle(fresh);

    expect(freshOps.deploys).toHaveLength(5);
    expect((await fresh.currentJob())?.id).not.toBe("job-1");
    expect((await fresh.currentJob())?.status).toBe("succeeded");
  });

  test("discard while a job is running is rejected and does not clear the in-flight attempt", async () => {
    const stores = fakeOpsStores();
    const { service } = harness(
      recordingOps(),
      stores,
      { nowMs: (): number => 1_000_000, randomId: (): string => "job-1" },
      {
        scheduleWork: (): void => undefined,
      },
    );

    await service.startStandUp(SMALL_STANDUP_INTENT);

    await expect(service.discardStandUp()).rejects.toThrow(/^busy$/u);
    await expect(service.currentJob()).resolves.toMatchObject({ id: "job-1", status: "running" });
  });

  test("start is busy when a checkpointed failed job cannot be reopened", async () => {
    const stores = {
      jobs: idleJobs({
        latest: () =>
          Promise.resolve({
            id: "job-1",
            kind: "standup" as const,
            status: "failed" as const,
            error: "deploy failed",
            steps: [{ seq: 1, kind: "deploy", name: "leanImt" }],
          }),
        tryResume: () => Promise.resolve(false),
      }),
      standup: idleStandup({
        readCheckpoint: () => Promise.resolve({ leanImt: "0xaaa" }),
      }),
    };
    const { service } = harness(recordingOps(), stores);

    await expect(service.startStandUp(SMALL_STANDUP_INTENT)).rejects.toThrow(/^busy$/u);
  });

  test("a new job numbers steps from 1 when latest is a different job", async () => {
    const recorded: { seq: number; name: string }[] = [];
    let succeeded = false;
    const stores = {
      jobs: idleJobs({
        appendStep: (_jobId, step) => {
          recorded.push({ seq: step.seq, name: step.name });

          return Promise.resolve();
        },
        latest: () =>
          Promise.resolve({
            id: "job-old",
            kind: "standup" as const,
            status: "succeeded" as const,
            steps: [{ seq: 40, kind: "invoke", name: "set_target" }],
          }),
      }),
      standup: idleStandup({
        succeed: () => {
          succeeded = true;

          return Promise.resolve();
        },
      }),
    };
    const { service } = harness(recordingOps(), stores);

    await service.startStandUp(SMALL_STANDUP_INTENT);
    await vi.waitFor(() => {
      expect(succeeded).toBe(true);
    });

    expect(recorded[0]).toEqual({ seq: 1, name: "leanImt" });
  });

  test("recover marks a running job interrupted so start can resume", async () => {
    const stores = fakeOpsStores();
    const clock = jobClock();
    const { service } = harness(recordingOps(), stores, clock);

    await stores.jobs.tryBegin({ id: "job-1", kind: "standup", createdAtMs: 1_000_001 });
    await stores.standup.mergeCheckpoint({ leanImt: "0xaaa" });
    await stores.jobs.appendStep("job-1", { seq: 1, kind: "deploy", name: "leanImt" });

    await expect(service.currentJob()).resolves.toMatchObject({ id: "job-1", status: "running" });
    await expect(service.hasIncompleteStandUp()).resolves.toBe(true);

    await service.recoverInterrupted();

    await expect(service.currentJob()).resolves.toMatchObject({ status: "interrupted", error: "interrupted" });

    const resumeOps = recordingOps();
    const { service: resume } = harness(resumeOps, stores, clock);

    await expect(resume.startStandUp(SMALL_STANDUP_INTENT)).resolves.toEqual({ jobId: "job-1" });
    await settle(resume);

    expect(resumeOps.deploys).toHaveLength(4);
    expect(resumeOps.deploys).not.toContain("0xaaa");
    expect((await resume.currentJob())?.status).toBe("succeeded");
  });

  test("no instance is recorded when set_target fails", async () => {
    const { service } = harness(recordingOps({ failOn: "set_target" }));

    await service.startStandUp(SMALL_STANDUP_INTENT);
    await settle(service);

    const job = await service.currentJob();

    expect(job?.status).toBe("failed");
    expect(job?.error).toBe("set_target failed");
    expect(job?.steps.some((step) => step.name === "set_target")).toBe(false);
    await expect(service.hasIncompleteStandUp()).resolves.toBe(true);
    await expect(service.listMacis({ page: 1, pageSize: 10 })).resolves.toEqual({ items: [], total: 0 });
  });

  test("failed set_target then start skips every deployUnique", async () => {
    const stores = fakeOpsStores();
    const clock = jobClock();
    const { service } = harness(recordingOps({ failOn: "set_target" }), stores, clock);

    await service.startStandUp(SMALL_STANDUP_INTENT);
    await settle(service);

    const resumeOps = recordingOps();
    const { service: resume } = harness(resumeOps, stores, clock);

    await resume.startStandUp(SMALL_STANDUP_INTENT);
    await settle(resume);

    expect(resumeOps.deploys).toHaveLength(0);
    expect((await resume.currentJob())?.status).toBe("succeeded");
    await expect(resume.hasIncompleteStandUp()).resolves.toBe(false);
  });

  test("no instance is recorded when the coordinator check fails", async () => {
    const { service } = harness(recordingOps({ failOn: "coordinator" }));

    await service.startStandUp(SMALL_STANDUP_INTENT);
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

    await service.startStandUp(SMALL_STANDUP_INTENT);
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

    await service.startStandUp(SMALL_STANDUP_INTENT);
    const unsubFirst = await service.subscribe((event) => {
      firstLog.push(event);
    });
    const unsubSecond = await service.subscribe((event) => {
      secondLog.push(event);
    });

    await expect(service.startStandUp(SMALL_STANDUP_INTENT)).rejects.toThrow(/^busy$/u);
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
    const stores = fakeOpsStores();
    const recorded = stores.jobs.appendStep.bind(stores.jobs);
    const events: JobEvent[] = [];
    let service: StandupService | undefined;

    stores.jobs.appendStep = (jobId, step): Promise<void> =>
      recorded(jobId, step).then(async () => {
        if (step.seq === 1 && service !== undefined) {
          await service.subscribe((event) => {
            events.push(event);
          });
        }
      });

    service = harness(recordingOps(), stores).service;

    await service.startStandUp(SMALL_STANDUP_INTENT);
    await settle(service);

    const steps = events.filter((event) => event.type === "step");
    expect(steps).toHaveLength(6);
    expect(new Set(steps.map((event) => event.step.seq)).size).toBe(6);
    expect(events.at(-1)).toEqual({ type: "completed", status: "succeeded" });
  });

  test("store failure while finishing the job does not reject startStandUp", async () => {
    const stores = fakeOpsStores();
    stores.jobs.fail = (): Promise<void> => Promise.reject(new Error("db down"));
    const { service } = harness(recordingOps({ failOn: "set_target" }), stores);

    await expect(service.startStandUp(SMALL_STANDUP_INTENT)).resolves.toEqual({ jobId: "job-1" });
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

    await service.startStandUp(SMALL_STANDUP_INTENT);
    await settle(service);

    expect(events.at(-1)).toEqual({ type: "completed", status: "succeeded" });
    unsub();
  });

  test("subscribe on a running job does not replay stored declare steps", async () => {
    const stores = {
      jobs: idleJobs({
        latest: () =>
          Promise.resolve({
            id: "job-1",
            kind: "standup" as const,
            status: "running" as const,
            steps: [
              { seq: 1, kind: "declare", name: "LeanIMT" },
              { seq: 2, kind: "deploy", name: "leanImt" },
            ],
          }),
      }),
      standup: idleStandup(),
    };
    const { service } = harness(recordingOps(), stores);
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

    await service.startStandUp(SMALL_STANDUP_INTENT);
    await settle(service);

    const steps = events.filter((event) => event.type === "step");
    expect(steps.map((event) => event.step.kind)).toEqual(["deploy", "deploy", "deploy", "deploy", "deploy", "invoke"]);
    unsub();
  });

  test("subscribe replays an interrupted job's completion", async () => {
    const stores = fakeOpsStores();
    const { service } = harness(recordingOps(), stores);

    await stores.jobs.tryBegin({ id: "job-1", kind: "standup", createdAtMs: 1_000_001 });
    await service.recoverInterrupted();

    const events: JobEvent[] = [];

    await service.subscribe((event) => {
      events.push(event);
    });

    expect(events).toEqual([{ type: "completed", status: "interrupted", error: "interrupted" }]);
  });

  test("subscribe replays a failed job's completion", async () => {
    const { service } = harness(recordingOps({ failOn: "set_target" }));
    const events: JobEvent[] = [];

    await service.startStandUp(SMALL_STANDUP_INTENT);
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

    await service.startStandUp(SMALL_STANDUP_INTENT);
    await settle(service);

    await expect(service.currentJob()).resolves.toMatchObject({ status: "failed", error: "failed" });
    await expect(service.listMacis({ page: 1, pageSize: 10 })).resolves.toEqual({ items: [], total: 0 });
  });
});
