import { describe, expect, it, vi } from "vitest";

import { createStandUpCatalogStore } from "../standUpCatalog.js";

const CATALOG = {
  circuitProfiles: [{ id: "small", maxSignups: 32, maxVoteOptions: 5 }],
  policies: [{ id: "Free for all" }],
  assigners: [{ id: "Constant vote balance" }],
};

describe("stand-up catalog store", () => {
  it("loads the stand-up catalog with the Operator JWT", async () => {
    const readStandUpCatalog = vi.fn().mockResolvedValue(CATALOG);
    const store = createStandUpCatalogStore({ readStandUpCatalog });

    await store.getState().load("jwt");

    expect(readStandUpCatalog).toHaveBeenCalledWith("jwt");
    expect(store.getState().catalog).toEqual(CATALOG);
    expect(store.getState().error).toBeUndefined();
  });

  it("does not load a catalog without a JWT", async () => {
    const readStandUpCatalog = vi.fn();
    const store = createStandUpCatalogStore({ readStandUpCatalog });

    await store.getState().load(undefined);
    await store.getState().load("");

    expect(readStandUpCatalog).not.toHaveBeenCalled();
    expect(store.getState().catalog).toBeUndefined();
  });

  it("surfaces a catalog error", async () => {
    const store = createStandUpCatalogStore({
      readStandUpCatalog: vi.fn().mockRejectedValue(new Error("catalog failed")),
    });

    await store.getState().load("jwt");

    expect(store.getState().error).toBe("catalog failed");
    expect(store.getState().catalog).toBeUndefined();
  });

  it("ignores a stale catalog response", async () => {
    const later = {
      circuitProfiles: [{ id: "small", maxSignups: 64, maxVoteOptions: 5 }],
      policies: [{ id: "Free for all" }],
      assigners: [{ id: "Constant vote balance" }],
    };
    let resolveFirst: (catalog: typeof CATALOG) => void = (): void => undefined;
    const readStandUpCatalog = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<typeof CATALOG>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce(later);
    const store = createStandUpCatalogStore({ readStandUpCatalog });
    const first = store.getState().load("jwt");
    const second = store.getState().load("jwt-2");

    await second;
    resolveFirst(CATALOG);
    await first;

    expect(store.getState().catalog).toEqual(later);
  });

  it("surfaces a non-Error catalog failure", async () => {
    const store = createStandUpCatalogStore({
      readStandUpCatalog: vi.fn().mockRejectedValue("down"),
    });

    await store.getState().load("jwt");

    expect(store.getState().error).toBe("catalog failed");
    expect(store.getState().catalog).toBeUndefined();
  });

  it("ignores a stale catalog error", async () => {
    let rejectFirst: (reason: unknown) => void = (): void => undefined;
    const readStandUpCatalog = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<typeof CATALOG>((_resolve, reject) => {
            rejectFirst = reject;
          }),
      )
      .mockResolvedValueOnce(CATALOG);
    const store = createStandUpCatalogStore({ readStandUpCatalog });
    const first = store.getState().load("jwt");
    const second = store.getState().load("jwt-2");

    await second;
    rejectFirst(new Error("catalog failed"));
    await first;

    expect(store.getState().catalog).toEqual(CATALOG);
    expect(store.getState().error).toBeUndefined();
  });

  it("resets catalog state", async () => {
    const store = createStandUpCatalogStore({
      readStandUpCatalog: vi.fn().mockResolvedValue(CATALOG),
    });

    await store.getState().load("jwt");
    store.getState().reset();

    expect(store.getState().catalog).toBeUndefined();
    expect(store.getState().error).toBeUndefined();
    expect(store.getState().generation).toBe(0);
  });
});
