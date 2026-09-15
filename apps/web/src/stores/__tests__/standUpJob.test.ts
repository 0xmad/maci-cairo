import { describe, expect, it, vi } from "vitest";

import { createStandUpJobStore } from "../standUpJob";

const SNAPSHOT = {
  id: "job-1",
  kind: "standup" as const,
  status: "running" as const,
  steps: [{ seq: 1, kind: "declare", name: "LeanIMT" }],
};

describe("stand-up job store", () => {
  it("keeps steps from a running snapshot and drops them from a finished one", () => {
    const store = createStandUpJobStore({
      startStandUp: vi.fn(),
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
    const store = createStandUpJobStore({
      startStandUp: vi.fn(),
      readJobState: vi.fn(),
      discardStandUp: vi.fn(),
    });
    store.getState().applySnapshot(SNAPSHOT);

    store.getState().applySnapshot(undefined);

    expect(store.getState().job).toEqual(SNAPSHOT);
    expect(store.getState().steps).toEqual(SNAPSHOT.steps);
  });

  it("updates incomplete stand-up when the snapshot is missing", () => {
    const store = createStandUpJobStore({
      startStandUp: vi.fn(),
      readJobState: vi.fn(),
      discardStandUp: vi.fn(),
    });
    store.getState().applySnapshot(SNAPSHOT);

    store.getState().applySnapshot(undefined, true);

    expect(store.getState().job).toEqual(SNAPSHOT);
    expect(store.getState().incompleteStandUp).toBe(true);
  });

  it("appends a live step once and clears steps when the job completes", () => {
    const store = createStandUpJobStore({
      startStandUp: vi.fn(),
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
    const store = createStandUpJobStore({
      startStandUp: vi.fn(),
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
    const store = createStandUpJobStore({
      startStandUp: vi.fn(),
      readJobState: vi.fn(),
      discardStandUp: vi.fn(),
    });

    store.getState().applyEvent({ type: "completed", status: "failed", error: "set_target failed" });

    expect(store.getState().job).toBeUndefined();
    expect(store.getState().steps).toEqual([]);
  });

  it("records a watch failure", () => {
    const store = createStandUpJobStore({
      startStandUp: vi.fn(),
      readJobState: vi.fn(),
      discardStandUp: vi.fn(),
    });

    store.getState().failWatch("sse closed");

    expect(store.getState().error).toBe("sse closed");
  });

  it("resets job state", () => {
    const store = createStandUpJobStore({
      startStandUp: vi.fn(),
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
    const readJobState = vi.fn().mockResolvedValue({ job: SNAPSHOT, incompleteStandUp: false });
    const store = createStandUpJobStore({ startStandUp, readJobState, discardStandUp: vi.fn() });
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
    const store = createStandUpJobStore({ startStandUp, readJobState: vi.fn(), discardStandUp: vi.fn() });

    await store.getState().startStandUp("jwt");

    expect(startStandUp).not.toHaveBeenCalled();
    expect(store.getState().error).toBe("Choose a circuit profile, policy, and vote balance assigner");
  });

  it("starts stand-up when the job snapshot is not yet available", async () => {
    const store = createStandUpJobStore({
      startStandUp: vi.fn().mockResolvedValue("job-1"),
      readJobState: vi.fn().mockResolvedValue({ job: undefined, incompleteStandUp: false }),
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
    const store = createStandUpJobStore({ startStandUp, readJobState: vi.fn(), discardStandUp: vi.fn() });

    await store.getState().startStandUp(undefined);

    expect(startStandUp).not.toHaveBeenCalled();
    expect(store.getState().error).toBe("Sign in as Operator first");
  });

  it("surfaces busy from the ops application", async () => {
    const store = createStandUpJobStore({
      startStandUp: vi.fn().mockRejectedValue(new Error("busy")),
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

  it("surfaces a non-Error stand-up failure", async () => {
    const store = createStandUpJobStore({
      startStandUp: vi.fn().mockRejectedValue("down"),
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

  it("discards an incomplete stand-up when idle", async () => {
    const discardStandUp = vi.fn().mockResolvedValue(undefined);
    const readJobState = vi.fn().mockResolvedValue({
      job: { ...SNAPSHOT, status: "failed" as const },
      incompleteStandUp: false,
    });
    const store = createStandUpJobStore({ startStandUp: vi.fn(), readJobState, discardStandUp });

    store.getState().applySnapshot(SNAPSHOT, true);
    await store.getState().discardStandUp("jwt");

    expect(discardStandUp).toHaveBeenCalledWith("jwt");
    expect(store.getState().incompleteStandUp).toBe(false);
    expect(store.getState().discarding).toBe(false);
  });

  it("discards when the job snapshot is not yet available", async () => {
    const store = createStandUpJobStore({
      startStandUp: vi.fn(),
      readJobState: vi.fn().mockResolvedValue({ job: undefined, incompleteStandUp: false }),
      discardStandUp: vi.fn().mockResolvedValue(undefined),
    });
    store.getState().applySnapshot(SNAPSHOT, true);

    await store.getState().discardStandUp("jwt");

    expect(store.getState().job).toEqual(SNAPSHOT);
    expect(store.getState().incompleteStandUp).toBe(false);
    expect(store.getState().discarding).toBe(false);
  });

  it("discards when the job snapshot is not yet available", async () => {
    const store = createStandUpJobStore({
      startStandUp: vi.fn(),
      readJobState: vi.fn().mockResolvedValue({ job: undefined, incompleteStandUp: false }),
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
    const store = createStandUpJobStore({ startStandUp: vi.fn(), readJobState: vi.fn(), discardStandUp });

    await store.getState().discardStandUp(undefined);

    expect(discardStandUp).not.toHaveBeenCalled();
    expect(store.getState().error).toBe("Sign in as Operator first");
  });

  it("rejects discard with an empty Operator JWT", async () => {
    const discardStandUp = vi.fn();
    const store = createStandUpJobStore({ startStandUp: vi.fn(), readJobState: vi.fn(), discardStandUp });

    await store.getState().discardStandUp("");

    expect(discardStandUp).not.toHaveBeenCalled();
    expect(store.getState().error).toBe("Sign in as Operator first");
  });

  it("surfaces a discard failure", async () => {
    const store = createStandUpJobStore({
      startStandUp: vi.fn(),
      readJobState: vi.fn(),
      discardStandUp: vi.fn().mockRejectedValue(new Error("busy")),
    });

    await store.getState().discardStandUp("jwt");

    expect(store.getState().error).toBe("busy");
    expect(store.getState().discarding).toBe(false);
  });

  it("surfaces a non-Error discard failure", async () => {
    const store = createStandUpJobStore({
      startStandUp: vi.fn(),
      readJobState: vi.fn(),
      discardStandUp: vi.fn().mockRejectedValue("down"),
    });

    await store.getState().discardStandUp("jwt");

    expect(store.getState().error).toBe("discard failed");
    expect(store.getState().discarding).toBe(false);
  });
});
