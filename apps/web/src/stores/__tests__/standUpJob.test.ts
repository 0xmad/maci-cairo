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
      readJob: vi.fn(),
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
      readJob: vi.fn(),
    });
    store.getState().applySnapshot(SNAPSHOT);

    store.getState().applySnapshot(undefined);

    expect(store.getState().job).toEqual(SNAPSHOT);
    expect(store.getState().steps).toEqual(SNAPSHOT.steps);
  });

  it("appends a live step once and clears steps when the job completes", () => {
    const store = createStandUpJobStore({
      startStandUp: vi.fn(),
      readJob: vi.fn(),
    });
    store.getState().applySnapshot(SNAPSHOT);

    store.getState().applyEvent({ type: "step", step: { seq: 2, kind: "deploy", name: "leanImt" } });
    store.getState().applyEvent({ type: "step", step: { seq: 2, kind: "deploy", name: "leanImt" } });

    expect(store.getState().steps.map((step) => step.seq)).toEqual([1, 2]);

    store.getState().applyEvent({ type: "completed", status: "succeeded" });

    expect(store.getState().steps).toEqual([]);
    expect(store.getState().job?.status).toBe("succeeded");
  });

  it("keeps job undefined when a completion event arrives first", () => {
    const store = createStandUpJobStore({
      startStandUp: vi.fn(),
      readJob: vi.fn(),
    });

    store.getState().applyEvent({ type: "completed", status: "failed", error: "set_target failed" });

    expect(store.getState().job).toBeUndefined();
    expect(store.getState().steps).toEqual([]);
  });

  it("records a watch failure", () => {
    const store = createStandUpJobStore({
      startStandUp: vi.fn(),
      readJob: vi.fn(),
    });

    store.getState().failWatch("sse closed");

    expect(store.getState().error).toBe("sse closed");
  });

  it("starts stand-up with the Operator JWT and hydrates the running job", async () => {
    const startStandUp = vi.fn().mockResolvedValue("job-1");
    const readJob = vi.fn().mockResolvedValue(SNAPSHOT);
    const store = createStandUpJobStore({ startStandUp, readJob });

    await store.getState().startStandUp("jwt");

    expect(startStandUp).toHaveBeenCalledWith("jwt");
    expect(startStandUp.mock.calls[0]).toHaveLength(1);
    expect(store.getState().job).toEqual(SNAPSHOT);
    expect(store.getState().steps).toEqual(SNAPSHOT.steps);
    expect(store.getState().starting).toBe(false);
    expect(store.getState().streamId).toBe(1);
  });

  it("starts stand-up when the job snapshot is not yet available", async () => {
    const store = createStandUpJobStore({
      startStandUp: vi.fn().mockResolvedValue("job-1"),
      readJob: vi.fn().mockResolvedValue(undefined),
    });

    await store.getState().startStandUp("jwt");

    expect(store.getState().job).toBeUndefined();
    expect(store.getState().starting).toBe(false);
    expect(store.getState().streamId).toBe(1);
  });

  it("rejects start without an Operator JWT", async () => {
    const startStandUp = vi.fn();
    const store = createStandUpJobStore({ startStandUp, readJob: vi.fn() });

    await store.getState().startStandUp(undefined);

    expect(startStandUp).not.toHaveBeenCalled();
    expect(store.getState().error).toBe("Sign in as Operator first");
  });

  it("surfaces busy from the ops application", async () => {
    const store = createStandUpJobStore({
      startStandUp: vi.fn().mockRejectedValue(new Error("busy")),
      readJob: vi.fn(),
    });

    await store.getState().startStandUp("jwt");

    expect(store.getState().error).toBe("busy");
    expect(store.getState().starting).toBe(false);
  });

  it("surfaces a non-Error stand-up failure", async () => {
    const store = createStandUpJobStore({
      startStandUp: vi.fn().mockRejectedValue("down"),
      readJob: vi.fn(),
    });

    await store.getState().startStandUp("jwt");

    expect(store.getState().error).toBe("stand-up failed");
    expect(store.getState().starting).toBe(false);
  });
});
