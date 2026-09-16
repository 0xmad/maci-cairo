import { describe, expect, it, vi } from "vitest";

import { createStandUpJobStore, type StandUpJobApi } from "../standUpJob";

function jobStore(api: Partial<StandUpJobApi> = {}) {
  return createStandUpJobStore({
    startStandUp: vi.fn(),
    startCreatePoll: vi.fn(),
    readJobState: vi.fn(),
    discardStandUp: vi.fn(),
    subscribeJobEvents: vi.fn(),
    ...api,
  });
}

const SNAPSHOT = {
  id: "job-1",
  kind: "standup" as const,
  status: "running" as const,
  steps: [{ seq: 1, kind: "declare", name: "LeanIMT" }],
};

describe("stand-up job store", () => {
  it("keeps steps from a running snapshot and drops them from a finished one", () => {
    const store = jobStore({
      startStandUp: vi.fn(),
      startCreatePoll: vi.fn(),
      readJobState: vi.fn(),
      discardStandUp: vi.fn(),
    });

    store.getState().applySnapshot(SNAPSHOT);
    expect(store.getState().steps).toEqual(SNAPSHOT.steps);

    store.getState().applySnapshot({ ...SNAPSHOT, status: "succeeded" });
    expect(store.getState().steps).toEqual([]);
    expect(store.getState().job?.status).toBe("succeeded");
  });

  it("ignores an undefined snapshot", () => {
    const store = jobStore({
      startStandUp: vi.fn(),
      startCreatePoll: vi.fn(),
      readJobState: vi.fn(),
      discardStandUp: vi.fn(),
    });
    store.getState().applySnapshot(SNAPSHOT);

    store.getState().applySnapshot(undefined);

    expect(store.getState().job).toEqual(SNAPSHOT);
    expect(store.getState().steps).toEqual(SNAPSHOT.steps);
  });

  it("updates incomplete stand-up when the snapshot is missing", () => {
    const store = jobStore({
      startStandUp: vi.fn(),
      startCreatePoll: vi.fn(),
      readJobState: vi.fn(),
      discardStandUp: vi.fn(),
    });
    store.getState().applySnapshot(SNAPSHOT);

    store.getState().applySnapshot(undefined, true);

    expect(store.getState().job).toEqual(SNAPSHOT);
    expect(store.getState().incompleteStandUp).toBe(true);
  });

  it("updates current MACI when the snapshot is missing", () => {
    const store = jobStore({
      startStandUp: vi.fn(),
      startCreatePoll: vi.fn(),
      readJobState: vi.fn(),
      discardStandUp: vi.fn(),
    });
    store.getState().applySnapshot(SNAPSHOT, false, "0x1");

    store.getState().applySnapshot(undefined, undefined, "0x7");

    expect(store.getState().job).toEqual(SNAPSHOT);
    expect(store.getState().currentMaci).toBe("0x7");
    expect(store.getState().incompleteStandUp).toBe(false);
  });

  it("appends a live step once and clears steps when the job completes", () => {
    const store = jobStore({
      startStandUp: vi.fn(),
      startCreatePoll: vi.fn(),
      readJobState: vi.fn(),
      discardStandUp: vi.fn(),
    });
    store.getState().applySnapshot(SNAPSHOT);

    store.getState().applyEvent({ type: "step", step: { seq: 2, kind: "deploy", name: "leanImt" } });
    store.getState().applyEvent({ type: "step", step: { seq: 2, kind: "deploy", name: "leanImt" } });

    expect(store.getState().steps.map((step) => step.seq)).toEqual([1, 2]);

    store.getState().applyEvent({ type: "completed", status: "succeeded" });

    expect(store.getState().steps).toEqual([]);
    expect(store.getState().job?.status).toBe("succeeded");
  });

  it("marks incomplete stand-up when a deploy job is interrupted", () => {
    const store = jobStore({
      startStandUp: vi.fn(),
      startCreatePoll: vi.fn(),
      readJobState: vi.fn(),
      discardStandUp: vi.fn(),
    });
    store.getState().applySnapshot(SNAPSHOT);
    store.getState().applyEvent({ type: "step", step: { seq: 2, kind: "deploy", name: "leanImt" } });
    store.getState().applyEvent({ type: "completed", status: "interrupted", error: "interrupted" });

    expect(store.getState().job?.status).toBe("interrupted");
    expect(store.getState().incompleteStandUp).toBe(true);
    expect(store.getState().steps).toEqual([]);
  });

  it("keeps job undefined when a completion event arrives first", () => {
    const store = jobStore({
      startStandUp: vi.fn(),
      startCreatePoll: vi.fn(),
      readJobState: vi.fn(),
      discardStandUp: vi.fn(),
    });

    store.getState().applyEvent({ type: "completed", status: "failed", error: "set_target failed" });

    expect(store.getState().job).toBeUndefined();
    expect(store.getState().steps).toEqual([]);
  });

  it("records a watch failure", () => {
    const store = jobStore({
      startStandUp: vi.fn(),
      startCreatePoll: vi.fn(),
      readJobState: vi.fn(),
      discardStandUp: vi.fn(),
    });

    store.getState().failWatch("sse closed");

    expect(store.getState().error).toBe("sse closed");
  });

  it("resets job state", () => {
    const store = jobStore({
      startStandUp: vi.fn(),
      startCreatePoll: vi.fn(),
      readJobState: vi.fn(),
      discardStandUp: vi.fn(),
    });
    store.getState().applySnapshot(SNAPSHOT, true);
    store.getState().failWatch("sse closed");

    store.getState().reset();

    expect(store.getState()).toMatchObject({
      starting: false,
      discarding: false,
      error: undefined,
      job: undefined,
      steps: [],
      incompleteStandUp: false,
      streamId: 0,
    });
  });

  it("starts stand-up with the Operator JWT and hydrates the running job", async () => {
    const startStandUp = vi.fn().mockResolvedValue("job-1");
    const readJobState = vi.fn().mockResolvedValue({ job: SNAPSHOT, incompleteStandUp: false, currentMaci: null });
    const store = jobStore({
      startStandUp,
      startCreatePoll: vi.fn(),
      readJobState,
      discardStandUp: vi.fn(),
    });
    const intent = {
      circuitProfile: "small",
      policy: "Free for all",
      assigner: "Constant vote balance",
      voteBalance: 3,
    };

    await store.getState().startStandUp("jwt", intent);

    expect(startStandUp).toHaveBeenCalledWith("jwt", intent);
    expect(store.getState().job).toEqual(SNAPSHOT);
    expect(store.getState().steps).toEqual(SNAPSHOT.steps);
    expect(store.getState().starting).toBe(false);
    expect(store.getState().streamId).toBe(1);
  });

  it("rejects start without a stand-up selection", async () => {
    const startStandUp = vi.fn();
    const store = jobStore({
      startStandUp,
      startCreatePoll: vi.fn(),
      readJobState: vi.fn(),
      discardStandUp: vi.fn(),
    });

    await store.getState().startStandUp("jwt");

    expect(startStandUp).not.toHaveBeenCalled();
    expect(store.getState().error).toBe("Choose a circuit profile, policy, and vote balance assigner");
  });

  it("starts stand-up when the job snapshot is not yet available", async () => {
    const store = jobStore({
      startStandUp: vi.fn().mockResolvedValue("job-1"),
      startCreatePoll: vi.fn(),
      readJobState: vi.fn().mockResolvedValue({ job: undefined, incompleteStandUp: false, currentMaci: null }),
      discardStandUp: vi.fn(),
    });

    await store.getState().startStandUp("jwt", {
      circuitProfile: "small",
      policy: "Free for all",
      assigner: "Constant vote balance",
      voteBalance: 3,
    });

    expect(store.getState().job).toBeUndefined();
    expect(store.getState().starting).toBe(false);
    expect(store.getState().streamId).toBe(1);
  });

  it("rejects start without an Operator JWT", async () => {
    const startStandUp = vi.fn();
    const store = jobStore({
      startStandUp,
      startCreatePoll: vi.fn(),
      readJobState: vi.fn(),
      discardStandUp: vi.fn(),
    });

    await store.getState().startStandUp(undefined);

    expect(startStandUp).not.toHaveBeenCalled();
    expect(store.getState().error).toBe("Sign in as Operator first");
  });

  it("surfaces busy from the ops application", async () => {
    const store = jobStore({
      startStandUp: vi.fn().mockRejectedValue(new Error("busy")),
      startCreatePoll: vi.fn(),
      readJobState: vi.fn(),
      discardStandUp: vi.fn(),
    });

    await store.getState().startStandUp("jwt", {
      circuitProfile: "small",
      policy: "Free for all",
      assigner: "Constant vote balance",
      voteBalance: 3,
    });

    expect(store.getState().error).toBe("busy");
    expect(store.getState().starting).toBe(false);
  });

  it("starts Create Poll with the Operator JWT and hydrates the running job", async () => {
    const startCreatePoll = vi.fn().mockResolvedValue("job-2");
    const snapshot = {
      id: "job-2",
      kind: "create_poll" as const,
      status: "running" as const,
      steps: [{ seq: 1, kind: "call", name: "next_poll_id" }],
    };
    const readJobState = vi.fn().mockResolvedValue({
      job: snapshot,
      incompleteStandUp: false,
      currentMaci: "0x7",
    });
    const store = jobStore({
      startStandUp: vi.fn(),
      startCreatePoll,
      readJobState,
      discardStandUp: vi.fn(),
    });
    const intent = { startDate: 10, endDate: 20, pollPublicKey: ["3", "4"] };

    await store.getState().startCreatePoll("jwt", "0x7", intent);

    expect(startCreatePoll).toHaveBeenCalledWith("jwt", "0x7", intent);
    expect(store.getState().job).toEqual(snapshot);
    expect(store.getState().steps).toEqual(snapshot.steps);
    expect(store.getState().currentMaci).toBe("0x7");
    expect(store.getState().starting).toBe(false);
    expect(store.getState().streamId).toBe(1);
  });

  it("rejects Create Poll without an Operator JWT", async () => {
    const startCreatePoll = vi.fn();
    const store = jobStore({
      startStandUp: vi.fn(),
      startCreatePoll,
      readJobState: vi.fn(),
      discardStandUp: vi.fn(),
    });

    await store.getState().startCreatePoll(undefined, "0x7", {
      startDate: 0,
      endDate: 1,
      pollPublicKey: ["0", "1"],
    });

    expect(startCreatePoll).not.toHaveBeenCalled();
    expect(store.getState().error).toBe("Sign in as Operator first");
  });

  it("rejects Create Poll without a schedule and public key", async () => {
    const startCreatePoll = vi.fn();
    const store = jobStore({
      startStandUp: vi.fn(),
      startCreatePoll,
      readJobState: vi.fn(),
      discardStandUp: vi.fn(),
    });

    await store.getState().startCreatePoll("jwt", "0x7");

    expect(startCreatePoll).not.toHaveBeenCalled();
    expect(store.getState().error).toBe("Choose a schedule and Poll public key");
  });

  it("rejects Create Poll without a MACI address", async () => {
    const startCreatePoll = vi.fn();
    const store = jobStore({
      startStandUp: vi.fn(),
      startCreatePoll,
      readJobState: vi.fn(),
      discardStandUp: vi.fn(),
    });

    await store.getState().startCreatePoll("jwt", undefined, {
      startDate: 0,
      endDate: 1,
      pollPublicKey: ["0", "1"],
    });

    expect(startCreatePoll).not.toHaveBeenCalled();
    expect(store.getState().error).toBe("MACI address required");
  });

  it("surfaces a non-Error stand-up failure", async () => {
    const store = jobStore({
      startStandUp: vi.fn().mockRejectedValue("down"),
      startCreatePoll: vi.fn(),
      readJobState: vi.fn(),
      discardStandUp: vi.fn(),
    });

    await store.getState().startStandUp("jwt", {
      circuitProfile: "small",
      policy: "Free for all",
      assigner: "Constant vote balance",
      voteBalance: 3,
    });

    expect(store.getState().error).toBe("stand-up failed");
    expect(store.getState().starting).toBe(false);
  });

  it("surfaces a non-Error Create Poll failure", async () => {
    const store = jobStore({
      startStandUp: vi.fn(),
      startCreatePoll: vi.fn().mockRejectedValue("down"),
      readJobState: vi.fn(),
      discardStandUp: vi.fn(),
    });

    await store.getState().startCreatePoll("jwt", "0x7", {
      startDate: 10,
      endDate: 20,
      pollPublicKey: ["3", "4"],
    });

    expect(store.getState().error).toBe("Create Poll failed");
    expect(store.getState().starting).toBe(false);
  });

  it("discards an incomplete stand-up when idle", async () => {
    const discardStandUp = vi.fn().mockResolvedValue(undefined);
    const readJobState = vi.fn().mockResolvedValue({
      job: { ...SNAPSHOT, status: "failed" as const },
      incompleteStandUp: false,
      currentMaci: null,
    });
    const store = jobStore({
      startStandUp: vi.fn(),
      startCreatePoll: vi.fn(),
      readJobState,
      discardStandUp,
    });

    store.getState().applySnapshot(SNAPSHOT, true);
    await store.getState().discardStandUp("jwt");

    expect(discardStandUp).toHaveBeenCalledWith("jwt");
    expect(store.getState().incompleteStandUp).toBe(false);
    expect(store.getState().discarding).toBe(false);
  });

  it("discards when the job snapshot is not yet available", async () => {
    const store = jobStore({
      startStandUp: vi.fn(),
      startCreatePoll: vi.fn(),
      readJobState: vi.fn().mockResolvedValue({ job: undefined, incompleteStandUp: false, currentMaci: null }),
      discardStandUp: vi.fn().mockResolvedValue(undefined),
    });
    store.getState().applySnapshot(SNAPSHOT, true);

    await store.getState().discardStandUp("jwt");

    expect(store.getState().job).toEqual(SNAPSHOT);
    expect(store.getState().incompleteStandUp).toBe(false);
    expect(store.getState().discarding).toBe(false);
  });

  it("rejects discard without an Operator JWT", async () => {
    const discardStandUp = vi.fn();
    const store = jobStore({
      startStandUp: vi.fn(),
      startCreatePoll: vi.fn(),
      readJobState: vi.fn(),
      discardStandUp,
    });

    await store.getState().discardStandUp(undefined);

    expect(discardStandUp).not.toHaveBeenCalled();
    expect(store.getState().error).toBe("Sign in as Operator first");
  });

  it("rejects discard with an empty Operator JWT", async () => {
    const discardStandUp = vi.fn();
    const store = jobStore({
      startStandUp: vi.fn(),
      startCreatePoll: vi.fn(),
      readJobState: vi.fn(),
      discardStandUp,
    });

    await store.getState().discardStandUp("");

    expect(discardStandUp).not.toHaveBeenCalled();
    expect(store.getState().error).toBe("Sign in as Operator first");
  });

  it("surfaces a discard failure", async () => {
    const store = jobStore({
      startStandUp: vi.fn(),
      startCreatePoll: vi.fn(),
      readJobState: vi.fn(),
      discardStandUp: vi.fn().mockRejectedValue(new Error("busy")),
    });

    await store.getState().discardStandUp("jwt");

    expect(store.getState().error).toBe("busy");
    expect(store.getState().discarding).toBe(false);
  });

  it("surfaces a non-Error discard failure", async () => {
    const store = jobStore({
      startStandUp: vi.fn(),
      startCreatePoll: vi.fn(),
      readJobState: vi.fn(),
      discardStandUp: vi.fn().mockRejectedValue("down"),
    });

    await store.getState().discardStandUp("jwt");

    expect(store.getState().error).toBe("discard failed");
    expect(store.getState().discarding).toBe(false);
  });

  it("does not watch the job stream without a JWT", async () => {
    const readJobState = vi.fn();
    const subscribeJobEvents = vi.fn();
    const store = jobStore({ readJobState, subscribeJobEvents });

    store.getState().applySnapshot(SNAPSHOT);
    await store.getState().watch(undefined);

    expect(readJobState).not.toHaveBeenCalled();
    expect(subscribeJobEvents).not.toHaveBeenCalled();
    expect(store.getState().job).toBeUndefined();
  });

  it("hydrates a running job from the snapshot and subscribes", async () => {
    const subscribeJobEvents = vi.fn().mockResolvedValue(undefined);
    const store = jobStore({
      readJobState: vi.fn().mockResolvedValue({ job: SNAPSHOT, incompleteStandUp: false, currentMaci: "0x7" }),
      subscribeJobEvents,
    });

    await store.getState().watch("jwt");

    expect(store.getState().job).toEqual(SNAPSHOT);
    expect(store.getState().currentMaci).toBe("0x7");
    expect(subscribeJobEvents).toHaveBeenCalled();
  });

  it("ignores a failed job snapshot read", async () => {
    const store = jobStore({
      readJobState: vi.fn().mockRejectedValue(new Error("job failed")),
      subscribeJobEvents: vi.fn().mockResolvedValue(undefined),
    });

    await store.getState().watch("jwt");

    expect(store.getState().job).toBeUndefined();
    expect(store.getState().error).toBeUndefined();
  });

  it("applies a live job event", async () => {
    let onEvent: ((event: { type: "step"; step: { seq: number; kind: string; name: string } }) => void) | undefined;
    const store = jobStore({
      readJobState: vi.fn().mockResolvedValue({ job: undefined, incompleteStandUp: false, currentMaci: null }),
      subscribeJobEvents: vi.fn(
        (
          _token: string,
          listener: (event: { type: "step"; step: { seq: number; kind: string; name: string } }) => void,
        ): Promise<void> => {
          onEvent = listener;

          return Promise.resolve();
        },
      ),
    });

    await store.getState().watch("jwt");
    onEvent?.({ type: "step", step: { seq: 1, kind: "declare", name: "LeanIMT" } });

    expect(store.getState().steps).toEqual([{ seq: 1, kind: "declare", name: "LeanIMT" }]);
  });

  it("does not apply a job event after abort", async () => {
    const abort = new AbortController();
    let onEvent: ((event: { type: "step"; step: { seq: number; kind: string; name: string } }) => void) | undefined;
    const store = jobStore({
      readJobState: vi.fn().mockResolvedValue({ job: undefined, incompleteStandUp: false, currentMaci: null }),
      subscribeJobEvents: vi.fn(
        (
          _token: string,
          listener: (event: { type: "step"; step: { seq: number; kind: string; name: string } }) => void,
        ): Promise<void> => {
          onEvent = listener;

          return Promise.resolve();
        },
      ),
    });

    await store.getState().watch("jwt", abort.signal);
    abort.abort();
    onEvent?.({ type: "step", step: { seq: 1, kind: "declare", name: "LeanIMT" } });

    expect(store.getState().steps).toEqual([]);
  });

  it("records a subscribe failure", async () => {
    const store = jobStore({
      readJobState: vi.fn().mockResolvedValue({ job: undefined, incompleteStandUp: false, currentMaci: null }),
      subscribeJobEvents: vi.fn().mockRejectedValue(new Error("sse closed")),
    });

    await store.getState().watch("jwt");

    expect(store.getState().error).toBe("sse closed");
  });

  it("ignores an aborted subscribe", async () => {
    const abortError = Object.assign(new Error("aborted"), { name: "AbortError" });
    const store = jobStore({
      readJobState: vi.fn().mockResolvedValue({ job: undefined, incompleteStandUp: false, currentMaci: null }),
      subscribeJobEvents: vi.fn().mockRejectedValue(abortError),
    });

    await store.getState().watch("jwt");

    expect(store.getState().error).toBeUndefined();
  });

  it("ignores a subscribe rejection after abort", async () => {
    const abort = new AbortController();
    const store = jobStore({
      readJobState: vi.fn().mockResolvedValue({ job: undefined, incompleteStandUp: false, currentMaci: null }),
      subscribeJobEvents: vi.fn((_token: string, _onEvent: unknown, signal?: AbortSignal): Promise<void> => {
        abort.abort();

        if (signal?.aborted) {
          return Promise.reject(new Error("sse closed"));
        }

        return Promise.resolve();
      }),
    });

    await store.getState().watch("jwt", abort.signal);

    expect(store.getState().error).toBeUndefined();
  });

  it("does not apply a job snapshot after abort", async () => {
    const abort = new AbortController();
    let resolveJob: (state: {
      job: typeof SNAPSHOT;
      incompleteStandUp: boolean;
      currentMaci: string | null;
    }) => void = (): void => undefined;
    const store = jobStore({
      readJobState: () =>
        new Promise((resolve) => {
          resolveJob = resolve;
        }),
      subscribeJobEvents: vi.fn().mockResolvedValue(undefined),
    });
    const watching = store.getState().watch("jwt", abort.signal);

    abort.abort();
    resolveJob({ job: SNAPSHOT, incompleteStandUp: false, currentMaci: null });
    await watching;

    expect(store.getState().job).toBeUndefined();
  });
});
