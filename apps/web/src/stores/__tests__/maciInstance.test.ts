import { describe, expect, it, vi } from "vitest";

import { createMaciInstanceStore } from "../maciInstance.js";

const INSTANCE = {
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
  network: "starknet_local" as const,
  circuitProfile: "small",
  policy: "Free for all",
  voteBalanceAssigner: "Constant vote balance",
};

describe("MACI instance store", () => {
  it("loads the MACI instance for an address", async () => {
    const readMaci = vi.fn().mockResolvedValue(INSTANCE);
    const store = createMaciInstanceStore({ readMaci });

    await store.getState().load("jwt", "0x7");

    expect(readMaci).toHaveBeenCalledWith("jwt", "0x7");
    expect(store.getState().instance).toEqual(INSTANCE);
    expect(store.getState().error).toBeUndefined();
  });

  it("does not load without a JWT or address", async () => {
    const readMaci = vi.fn();
    const store = createMaciInstanceStore({ readMaci });

    await store.getState().load(undefined, "0x7");
    await store.getState().load("jwt", undefined);
    await store.getState().load("jwt", "");

    expect(readMaci).not.toHaveBeenCalled();
    expect(store.getState().instance).toBeUndefined();
  });

  it("surfaces a missing instance as an error", async () => {
    const store = createMaciInstanceStore({
      readMaci: vi.fn().mockRejectedValue(new Error("maci not found")),
    });

    await store.getState().load("jwt", "0x7");

    expect(store.getState().error).toBe("maci not found");
    expect(store.getState().instance).toBeUndefined();
  });

  it("surfaces a non-Error instance failure", async () => {
    const store = createMaciInstanceStore({
      readMaci: vi.fn().mockRejectedValue("down"),
    });

    await store.getState().load("jwt", "0x7");

    expect(store.getState().error).toBe("MACI instance failed");
  });

  it("ignores a stale instance response", async () => {
    const later = { ...INSTANCE, maci: "0x22" };
    let resolveFirst: (instance: typeof INSTANCE) => void = (): void => undefined;
    const readMaci = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<typeof INSTANCE>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce(later);
    const store = createMaciInstanceStore({ readMaci });
    const first = store.getState().load("jwt", "0x7");
    const second = store.getState().load("jwt", "0x22");

    await second;
    resolveFirst(INSTANCE);
    await first;

    expect(store.getState().instance).toEqual(later);
  });

  it("ignores a stale instance error", async () => {
    let rejectFirst: (reason: unknown) => void = (): void => undefined;
    const readMaci = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<typeof INSTANCE>((_resolve, reject) => {
            rejectFirst = reject;
          }),
      )
      .mockResolvedValueOnce(INSTANCE);
    const store = createMaciInstanceStore({ readMaci });
    const first = store.getState().load("jwt", "0x7");
    const second = store.getState().load("jwt", "0x7");

    await second;
    rejectFirst(new Error("maci not found"));
    await first;

    expect(store.getState().instance).toEqual(INSTANCE);
    expect(store.getState().error).toBeUndefined();
  });

  it("resets instance state", async () => {
    const store = createMaciInstanceStore({
      readMaci: vi.fn().mockResolvedValue(INSTANCE),
    });

    await store.getState().load("jwt", "0x7");
    store.getState().reset();

    expect(store.getState().instance).toBeUndefined();
    expect(store.getState().generation).toBe(0);
  });
});
