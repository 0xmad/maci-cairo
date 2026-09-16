import { SMALL_STANDUP_INTENT } from "maci-deploy/intent";
import { type SncastOps } from "maci-deploy/maci";
import { describe, expect, test, vi } from "vitest";

import { JobEvents, type JobEvent } from "../../jobs/job.events.js";
import { type JobStore } from "../../jobs/job.store.js";
import { StandupService } from "../../standup/standup.service.js";
import { fakeOpsStores, jobClock, type OpsStores } from "../../tests/fakeOpsStores.js";
import { CREATE_POLL_INTENT, MACI_INSTANCE, pollOps, recordingOps } from "../../tests/sncastFixtures.js";
import { PollService } from "../poll.service.js";

function standHarness(
  ops: SncastOps = recordingOps(),
  stores: OpsStores = fakeOpsStores(),
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

  return { service, stores, events };
}

function pollHarness(
  ops: SncastOps = recordingOps(),
  stores: OpsStores = fakeOpsStores(),
  clock: { nowMs: () => number; randomId: () => string } = jobClock(),
  extra: { scheduleWork?: (work: () => void) => void; events?: JobEvents } = {},
) {
  const events = extra.events ?? new JobEvents();
  const poll = new PollService({
    jobs: stores.jobs,
    polls: stores.polls,
    standup: stores.standup,
    events,
    sncast: ops,
    nowMs: clock.nowMs,
    randomId: clock.randomId,
    scheduleWork: extra.scheduleWork,
  });

  return { poll, jobs: stores.jobs, events, stores };
}

async function startCreatePollOnRecorded(
  poll: PollService,
  stores: OpsStores,
  intent: typeof CREATE_POLL_INTENT = CREATE_POLL_INTENT,
): Promise<{ jobId: string }> {
  const listed = await stores.standup.listMacis({ page: 1, pageSize: 1 });

  return poll.startCreatePoll(listed.items[0]?.address ?? "0xmissing", intent);
}

async function settle(jobs: JobStore): Promise<void> {
  await vi.waitFor(async () => {
    const job = await jobs.latest();
    expect(job?.status).not.toBe("running");
  });
}

describe("PollService", () => {
  test("Create Poll is rejected without a recorded MACI", async () => {
    const { poll, jobs, stores } = pollHarness();

    await expect(startCreatePollOnRecorded(poll, stores)).rejects.toThrow(/^maci not found$/u);
    await expect(jobs.latest()).resolves.toBeUndefined();
  });

  test("list Polls is rejected without a recorded MACI", async () => {
    const { poll } = pollHarness();

    await expect(poll.listPolls("0xmissing", { page: 1, pageSize: 10 })).rejects.toThrow(/^maci not found$/u);
  });

  test("read Poll returns recorded Poll fields including MACI", async () => {
    const stores = fakeOpsStores();
    const clock = jobClock();
    const { service: stand } = standHarness(recordingOps(), stores, clock);

    await stand.startStandUp(SMALL_STANDUP_INTENT);
    await settle(stores.jobs);
    const listed = await stores.standup.listMacis({ page: 1, pageSize: 1 });
    const maci = listed.items[0]?.address ?? "0xmissing";

    await stores.polls.recordPoll({
      maci,
      address: "0xaa",
      pollId: "2",
      startDate: "0",
      endDate: "1000",
      pollPublicKey: ["0", "1"],
      createdAtMs: 1_000_200,
    });

    const { poll } = pollHarness(pollOps(), stores, clock);

    await expect(poll.readPoll("0xaa")).resolves.toEqual({
      address: "0xaa",
      pollId: "2",
      startDate: "0",
      endDate: "1000",
      pollPublicKey: ["0", "1"],
      createdAtMs: 1_000_200,
      maci,
    });
  });

  test("read Poll is rejected when the Poll is not recorded", async () => {
    const { poll } = pollHarness();

    await expect(poll.readPoll("0xaa")).rejects.toThrow(/^poll not found$/u);
  });

  test("Create Poll is rejected while an incomplete stand-up checkpoint exists", async () => {
    const stores = fakeOpsStores();
    const { service } = standHarness(recordingOps({ failOn: "set_target" }), stores);

    await service.startStandUp(SMALL_STANDUP_INTENT);
    await settle(stores.jobs);
    await expect(service.hasIncompleteStandUp()).resolves.toBe(true);

    const { poll } = pollHarness(recordingOps(), stores);

    await expect(startCreatePollOnRecorded(poll, stores)).rejects.toThrow(/^incomplete stand-up$/u);
  });

  test("Create Poll is rejected with a checkpoint even when current MACI is set", async () => {
    const stores = fakeOpsStores();
    const clock = jobClock();
    const { service: stand } = standHarness(recordingOps(), stores, clock);

    await stand.startStandUp(SMALL_STANDUP_INTENT);
    await settle(stores.jobs);

    const { service: failedStand } = standHarness(recordingOps({ failOn: "set_target" }), stores, clock);

    await failedStand.startStandUp(SMALL_STANDUP_INTENT);
    await settle(stores.jobs);
    await expect(failedStand.hasIncompleteStandUp()).resolves.toBe(true);
    await expect(failedStand.listMacis({ page: 1, pageSize: 1 })).resolves.toMatchObject({ total: 1 });

    const { poll } = pollHarness(recordingOps(), stores, clock);

    await expect(startCreatePollOnRecorded(poll, stores)).rejects.toThrow(/^incomplete stand-up$/u);
  });

  test("Create Poll is busy while a stand-up job is running", async () => {
    const stores = fakeOpsStores();
    const clock = { nowMs: (): number => 1_000_000, randomId: (): string => "job-1" };
    const { service } = standHarness(recordingOps(), stores, clock, { scheduleWork: (): void => undefined });

    await service.startStandUp(SMALL_STANDUP_INTENT);

    const { poll } = pollHarness(recordingOps(), stores, clock);

    await expect(startCreatePollOnRecorded(poll, stores)).rejects.toThrow(/^busy$/u);
  });

  test("Create Poll is busy while another job is running", async () => {
    const stores = fakeOpsStores();
    const clock = jobClock();
    const { service: stand } = standHarness(recordingOps(), stores, clock);

    await stand.startStandUp(SMALL_STANDUP_INTENT);
    await settle(stores.jobs);

    const sncast = pollOps();
    const first = pollHarness(sncast, stores, clock, { scheduleWork: (): void => undefined }).poll;
    const second = pollHarness(sncast, stores, clock).poll;

    await startCreatePollOnRecorded(first, stores);
    await expect(startCreatePollOnRecorded(second, stores)).rejects.toThrow(/^busy$/u);
  });

  test("Create Poll against current MACI freezes poll id and invokes once when get_poll is zero", async () => {
    const stores = fakeOpsStores();
    const clock = jobClock();
    const { service: stand } = standHarness(recordingOps(), stores, clock);

    await stand.startStandUp(SMALL_STANDUP_INTENT);
    await settle(stores.jobs);

    const maci = (await stand.listMacis({ page: 1, pageSize: 1 })).items[0]?.address ?? "";
    const sncast = pollOps({ nextPollId: "0x2", pollAfter: "0xaa", pollId: "0x2" });
    const { poll, jobs } = pollHarness(sncast, stores, clock);

    await expect(startCreatePollOnRecorded(poll, stores)).resolves.toEqual({ jobId: "job-2" });
    await settle(jobs);

    const job = await jobs.latest();
    const stored = await stores.polls.readCreatePoll("job-2");

    expect(job).toMatchObject({ id: "job-2", kind: "create_poll", status: "succeeded" });
    expect(stored?.maci).toBe(maci);
    expect(stored?.pollId).toBe("2");
    const listedPolls = await poll.listPolls(maci, { page: 1, pageSize: 10 });

    expect(listedPolls.total).toBe(1);
    expect(listedPolls.items[0]?.address).toBe("0x00000000000000000000000000000000000000000000000000000000000000aa");
    expect(listedPolls.items[0]?.pollId).toBe("2");
    expect(listedPolls.items[0]?.startDate).toBe("0");
    expect(listedPolls.items[0]?.endDate).toBe("1000");
    expect(listedPolls.items[0]?.pollPublicKey).toEqual(["0", "1"]);
    expect(listedPolls.items[0]?.createdAtMs).toBeGreaterThan(1_000_000);
    expect(sncast.fieldCalls.filter((args) => args[0] === "invoke" && args.includes("create_poll"))).toHaveLength(1);
    expect(sncast.fieldCalls.find((args) => args.includes("get_poll"))).toEqual(
      expect.arrayContaining(["get_poll", "2"]),
    );
    expect(job?.steps.map((step) => step.name)).toEqual([
      "next_poll_id",
      "coordinator",
      "get_poll",
      "create_poll",
      "get_poll",
    ]);
  });

  test("Create Poll subscribe emits preflight, invoke, and get_poll", async () => {
    const stores = fakeOpsStores();
    const clock = jobClock();
    const { service: stand } = standHarness(recordingOps(), stores, clock);

    await stand.startStandUp(SMALL_STANDUP_INTENT);
    await settle(stores.jobs);

    const sncast = pollOps({ nextPollId: "0x2", pollAfter: "0xaa", pollId: "0x2" });
    let queued: (() => void) | undefined;
    const { poll, jobs, events } = pollHarness(sncast, stores, clock, {
      scheduleWork: (work: () => void): void => {
        queued = work;
      },
    });
    const log: JobEvent[] = [];

    await startCreatePollOnRecorded(poll, stores);
    const unsub = events.subscribe(await jobs.latest(), (event) => {
      log.push(event);
    });
    queued?.();
    await settle(jobs);
    unsub();

    expect(log.filter((event) => event.type === "step").map((event) => event.step.name)).toEqual([
      "next_poll_id",
      "coordinator",
      "get_poll",
      "create_poll",
      "get_poll",
    ]);
    expect(log.at(-1)).toEqual({ type: "completed", status: "succeeded" });
  });

  test("Create Poll with a frozen id does not invoke when get_poll is already nonzero", async () => {
    const stores = fakeOpsStores();
    const clock = jobClock();
    const { service: stand } = standHarness(recordingOps(), stores, clock);

    await stand.startStandUp(SMALL_STANDUP_INTENT);
    await settle(stores.jobs);

    const failed = pollOps({ nextPollId: "0x3", pollAfter: "0x0", pollId: "0x3" });
    const { poll: first, jobs } = pollHarness(failed, stores, clock);

    await startCreatePollOnRecorded(first, stores);
    await settle(jobs);
    await expect(jobs.latest()).resolves.toMatchObject({ status: "failed" });
    await expect(stores.polls.readCreatePoll((await jobs.latest())?.id ?? "")).resolves.toMatchObject({ pollId: "3" });

    const retry = pollOps({ pollBefore: "0xbb", pollId: "0x3" });
    const { poll } = pollHarness(retry, stores, clock);

    await expect(startCreatePollOnRecorded(poll, stores)).resolves.toEqual({
      jobId: (await jobs.latest())?.id,
    });
    await settle(jobs);

    expect(retry.fieldCalls.some((args) => args[0] === "invoke")).toBe(false);
    expect(retry.fieldCalls.some((args) => args.includes("next_poll_id"))).toBe(false);
    expect(retry.fieldCalls.some((args) => args.includes("coordinator"))).toBe(true);
    await expect(jobs.latest()).resolves.toMatchObject({ status: "succeeded", kind: "create_poll" });
  });

  test("Create Poll skip-invoke fails when on-chain coordinator does not match current MACI", async () => {
    const stores = fakeOpsStores();
    const clock = jobClock();
    const { service: stand } = standHarness(recordingOps(), stores, clock);

    await stand.startStandUp(SMALL_STANDUP_INTENT);
    await settle(stores.jobs);

    const failed = pollOps({ nextPollId: "0x3", pollAfter: "0x0", pollId: "0x3" });
    const { poll: first, jobs } = pollHarness(failed, stores, clock);

    await startCreatePollOnRecorded(first, stores);
    await settle(jobs);

    const retry = pollOps({ pollBefore: "0xbb", pollId: "0x3", coordinatorOnChain: "0x2" });
    const { poll } = pollHarness(retry, stores, clock);

    await startCreatePollOnRecorded(poll, stores);
    await settle(jobs);

    expect(retry.fieldCalls.some((args) => args[0] === "invoke")).toBe(false);
    expect((await jobs.latest())?.error).toMatch(/^coordinator mismatch:/u);
  });

  test("Create Poll retries with a new schedule when poll id was not frozen", async () => {
    const stores = fakeOpsStores();
    const clock = jobClock();
    const { service: stand } = standHarness(recordingOps(), stores, clock);

    await stand.startStandUp(SMALL_STANDUP_INTENT);
    await settle(stores.jobs);

    const failed = pollOps({ nextPollId: "0x4" });
    const originalField = failed.field.bind(failed);
    failed.field = (key: string, args: string[]): string => {
      if (args.includes("next_poll_id")) {
        throw new Error("next_poll_id failed");
      }

      return originalField(key, args);
    };
    const { poll: first, jobs } = pollHarness(failed, stores, clock);

    await startCreatePollOnRecorded(first, stores);
    await settle(jobs);
    await expect(stores.polls.readCreatePoll((await jobs.latest())?.id ?? "")).resolves.toMatchObject({
      endDate: "1000",
    });
    expect((await stores.polls.readCreatePoll((await jobs.latest())?.id ?? ""))?.pollId).toBeUndefined();

    const retry = pollOps({ nextPollId: "0x5", pollAfter: "0xcc", pollId: "0x5" });
    const { poll } = pollHarness(retry, stores, clock);

    await startCreatePollOnRecorded(poll, stores, { ...CREATE_POLL_INTENT, endDate: 2000n });
    await settle(jobs);

    await expect(stores.polls.readCreatePoll((await jobs.latest())?.id ?? "")).resolves.toMatchObject({
      endDate: "2000",
      pollId: "5",
    });
    await expect(jobs.latest()).resolves.toMatchObject({ status: "succeeded" });
  });

  test("Create Poll checks coordinator against current MACI", async () => {
    const stores = fakeOpsStores();
    const clock = jobClock();
    await stores.jobs.tryBegin({ id: "standup-1", kind: "standup", createdAtMs: 1_000_000 });
    await stores.standup.succeed("standup-1", 1_000_100, MACI_INSTANCE);

    const sncast = pollOps({ coordinatorOnChain: "0x1", nextPollId: "0x0", pollAfter: "0xaa", pollId: "0x0" });
    const { poll, jobs } = pollHarness(sncast, stores, clock);

    await startCreatePollOnRecorded(poll, stores);
    await settle(jobs);

    await expect(jobs.latest()).resolves.toMatchObject({ status: "succeeded", kind: "create_poll" });
  });

  test("Create Poll fails when on-chain coordinator does not match current MACI", async () => {
    const stores = fakeOpsStores();
    const clock = jobClock();
    await stores.jobs.tryBegin({ id: "standup-1", kind: "standup", createdAtMs: 1_000_000 });
    await stores.standup.succeed("standup-1", 1_000_100, MACI_INSTANCE);

    const sncast = pollOps({ coordinatorOnChain: "0x2" });
    const { poll, jobs } = pollHarness(sncast, stores, clock);

    await startCreatePollOnRecorded(poll, stores);
    await settle(jobs);

    await expect(jobs.latest()).resolves.toMatchObject({
      status: "failed",
      kind: "create_poll",
    });
    expect((await jobs.latest())?.error).toMatch(/^coordinator mismatch:/u);
    expect(sncast.fieldCalls.some((args) => args[0] === "invoke")).toBe(false);
  });

  test("Create Poll is busy when a new job cannot begin", async () => {
    const stores = fakeOpsStores();
    const clock = jobClock();
    await stores.jobs.tryBegin({ id: "standup-1", kind: "standup", createdAtMs: 1_000_000 });
    await stores.standup.succeed("standup-1", 1_000_100, MACI_INSTANCE);
    stores.jobs.tryBegin = (): Promise<boolean> => Promise.resolve(false);

    const { poll } = pollHarness(pollOps(), stores, clock);

    await expect(startCreatePollOnRecorded(poll, stores)).rejects.toThrow(/^busy$/u);
  });

  test("Create Poll is busy when a failed Create Poll cannot resume", async () => {
    const stores = fakeOpsStores();
    const clock = jobClock();
    await stores.jobs.tryBegin({ id: "standup-1", kind: "standup", createdAtMs: 1_000_000 });
    await stores.standup.succeed("standup-1", 1_000_100, MACI_INSTANCE);
    await stores.jobs.tryBegin({ id: "job-2", kind: "create_poll", createdAtMs: 1_000_200 });
    await stores.jobs.fail("job-2", 1_000_300, "next_poll_id failed");
    await stores.polls.writeCreatePoll("job-2", {
      maci: MACI_INSTANCE.maci,
      startDate: "0",
      endDate: "1000",
      pollPublicKeyX: "0",
      pollPublicKeyY: "1",
      pollId: "3",
    });
    stores.jobs.tryResume = (): Promise<boolean> => Promise.resolve(false);

    const { poll } = pollHarness(pollOps(), stores, clock);

    await expect(startCreatePollOnRecorded(poll, stores)).rejects.toThrow(/^busy$/u);
  });

  test("Create Poll fails when the stored attempt is missing", async () => {
    const stores = fakeOpsStores();
    const clock = jobClock();
    await stores.jobs.tryBegin({ id: "standup-1", kind: "standup", createdAtMs: 1_000_000 });
    await stores.standup.succeed("standup-1", 1_000_100, MACI_INSTANCE);
    const originalRead = stores.polls.readCreatePoll.bind(stores.polls);
    let hide = false;
    stores.polls.readCreatePoll = (jobId: string): ReturnType<typeof originalRead> =>
      hide ? Promise.resolve(undefined) : originalRead(jobId);

    let queued: (() => void) | undefined;
    const { poll, jobs } = pollHarness(pollOps(), stores, clock, {
      scheduleWork: (work: () => void): void => {
        queued = work;
      },
    });

    await startCreatePollOnRecorded(poll, stores);
    hide = true;
    queued?.();
    await settle(jobs);

    await expect(jobs.latest()).resolves.toMatchObject({ status: "failed", error: "failed" });
  });

  test("Create Poll fails when current MACI cannot be loaded during the job", async () => {
    const stores = fakeOpsStores();
    const clock = jobClock();
    await stores.jobs.tryBegin({ id: "standup-1", kind: "standup", createdAtMs: 1_000_000 });
    await stores.standup.succeed("standup-1", 1_000_100, MACI_INSTANCE);
    const originalRead = stores.standup.readMaci.bind(stores.standup);
    let hide = false;
    stores.standup.readMaci = (address: string): ReturnType<typeof originalRead> =>
      hide ? Promise.resolve(undefined) : originalRead(address);

    let queued: (() => void) | undefined;
    const { poll, jobs } = pollHarness(pollOps(), stores, clock, {
      scheduleWork: (work: () => void): void => {
        queued = work;
      },
    });

    await startCreatePollOnRecorded(poll, stores);
    hide = true;
    queued?.();
    await settle(jobs);

    await expect(jobs.latest()).resolves.toMatchObject({ status: "failed", error: "MACI instance not found" });
  });

  test("Create Poll swallows a run rejection after the job is marked failed", async () => {
    const stores = fakeOpsStores();
    const clock = jobClock();
    await stores.jobs.tryBegin({ id: "standup-1", kind: "standup", createdAtMs: 1_000_000 });
    await stores.standup.succeed("standup-1", 1_000_100, MACI_INSTANCE);
    const originalFail = stores.jobs.fail.bind(stores.jobs);
    stores.jobs.fail = async (jobId: string, completedAtMs: number, error: string): Promise<void> => {
      await originalFail(jobId, completedAtMs, error);
      throw new Error("notify failed");
    };

    let queued: (() => void) | undefined;
    const { poll, jobs } = pollHarness(pollOps({ coordinatorOnChain: "0x2" }), stores, clock, {
      scheduleWork: (work: () => void): void => {
        queued = work;
      },
    });

    await startCreatePollOnRecorded(poll, stores);
    queued?.();
    await settle(jobs);

    await expect(jobs.latest()).resolves.toMatchObject({ status: "failed", kind: "create_poll" });
  });

  test("Create Poll starts a new job when the failed attempt is for another MACI", async () => {
    const stores = fakeOpsStores();
    let nowMs = 2_000_000;
    const clock = {
      nowMs: (): number => {
        nowMs += 1;

        return nowMs;
      },
      randomId: (): string => "job-3",
    };
    await stores.jobs.tryBegin({ id: "standup-1", kind: "standup", createdAtMs: 1_000_000 });
    await stores.standup.succeed("standup-1", 1_000_100, MACI_INSTANCE);
    await stores.jobs.tryBegin({ id: "job-2", kind: "create_poll", createdAtMs: 1_000_200 });
    await stores.jobs.fail("job-2", 1_000_300, "next_poll_id failed");
    await stores.polls.writeCreatePoll("job-2", {
      maci: "0xother",
      startDate: "0",
      endDate: "1000",
      pollPublicKeyX: "0",
      pollPublicKeyY: "1",
      pollId: "3",
    });

    const { poll, jobs } = pollHarness(
      pollOps({
        nextPollId: "0x2",
        pollAfter: "0xaa",
        pollId: "0x2",
        coordinatorOnChain: MACI_INSTANCE.coordinator,
      }),
      stores,
      clock,
    );

    await expect(startCreatePollOnRecorded(poll, stores)).resolves.toEqual({ jobId: "job-3" });
    await settle(jobs);

    await expect(jobs.latest()).resolves.toMatchObject({ id: "job-3", status: "succeeded", kind: "create_poll" });
    await expect(stores.polls.readCreatePoll("job-3")).resolves.toMatchObject({
      maci: MACI_INSTANCE.maci,
      pollId: "2",
    });
  });

  test("Create Poll resumes an interrupted Create Poll job", async () => {
    const stores = fakeOpsStores();
    const clock = jobClock();
    await stores.jobs.tryBegin({ id: "standup-1", kind: "standup", createdAtMs: 1_000_000 });
    await stores.standup.succeed("standup-1", 1_000_100, MACI_INSTANCE);
    await stores.jobs.tryBegin({ id: "job-2", kind: "create_poll", createdAtMs: 1_000_200 });
    await stores.jobs.interruptRunning(1_000_300, "interrupted");
    await stores.polls.writeCreatePoll("job-2", {
      maci: MACI_INSTANCE.maci,
      startDate: "0",
      endDate: "1000",
      pollPublicKeyX: "0",
      pollPublicKeyY: "1",
      pollId: "3",
    });

    const { poll, jobs } = pollHarness(
      pollOps({ pollBefore: "0xbb", pollId: "0x3", coordinatorOnChain: MACI_INSTANCE.coordinator }),
      stores,
      clock,
    );

    await expect(startCreatePollOnRecorded(poll, stores)).resolves.toEqual({ jobId: "job-2" });
    await settle(jobs);

    await expect(jobs.latest()).resolves.toMatchObject({ id: "job-2", status: "succeeded", kind: "create_poll" });
  });

  test("Create Poll numbers steps from 1 when latest is a different job", async () => {
    const stores = fakeOpsStores();
    const clock = jobClock();
    await stores.jobs.tryBegin({ id: "standup-1", kind: "standup", createdAtMs: 1_000_000 });
    await stores.standup.succeed("standup-1", 1_000_100, MACI_INSTANCE);
    const originalLatest = stores.jobs.latest.bind(stores.jobs);
    let otherLatest = false;
    stores.jobs.latest = (): ReturnType<typeof originalLatest> => {
      if (otherLatest) {
        otherLatest = false;

        return Promise.resolve({
          id: "other",
          kind: "create_poll",
          status: "succeeded",
          steps: [{ seq: 40, kind: "call", name: "next_poll_id" }],
        });
      }

      return originalLatest();
    };

    let queued: (() => void) | undefined;
    const { poll, jobs } = pollHarness(
      pollOps({ nextPollId: "0x2", pollAfter: "0xaa", pollId: "0x2", coordinatorOnChain: MACI_INSTANCE.coordinator }),
      stores,
      clock,
      {
        scheduleWork: (work: () => void): void => {
          queued = work;
        },
      },
    );

    await startCreatePollOnRecorded(poll, stores);
    otherLatest = true;
    queued?.();
    await settle(jobs);

    const latest = await jobs.latest();

    expect(latest?.status).toBe("succeeded");
    expect(latest?.steps.some((step) => step.seq === 1 && step.kind === "call" && step.name === "next_poll_id")).toBe(
      true,
    );
  });

  test("a non-Error throw from sncast fails Create Poll as failed", async () => {
    const stores = fakeOpsStores();
    const clock = jobClock();
    await stores.jobs.tryBegin({ id: "standup-1", kind: "standup", createdAtMs: 1_000_000 });
    await stores.standup.succeed("standup-1", 1_000_100, MACI_INSTANCE);
    const sncast = pollOps();
    sncast.field = (): string => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- catch must map non-Errors to "failed"
      throw "boom";
    };

    const { poll, jobs } = pollHarness(sncast, stores, clock);

    await startCreatePollOnRecorded(poll, stores);
    await settle(jobs);

    await expect(jobs.latest()).resolves.toMatchObject({ status: "failed", error: "failed" });
  });
});
