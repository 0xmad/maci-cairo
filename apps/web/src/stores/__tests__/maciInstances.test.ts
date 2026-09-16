import { describe, expect, it, vi } from "vitest";

import { createMaciInstancesStore, MACI_LIST_PAGE_SIZE } from "../maciInstances.js";

const PAGE = {
  items: [
    {
      address: "0x064b48806902a367c8598f4f95c305e8c1a1acba5f082d294a43793113115691",
      network: "starknet_local" as const,
      createdAtMs: 1_000_100,
    },
  ],
  total: 11,
  page: 1,
  pageSize: MACI_LIST_PAGE_SIZE,
};

describe("MACI instances store", () => {
  it("loads a MACI list page with the Operator JWT", async () => {
    const listMacis = vi.fn().mockResolvedValue(PAGE);
    const store = createMaciInstancesStore({ listMacis });

    await store.getState().load("jwt", 1);

    expect(listMacis).toHaveBeenCalledWith("jwt", 1, 10);
    expect(store.getState().items).toEqual(PAGE.items);
    expect(store.getState().pageCount).toBe(2);
    expect(store.getState().error).toBeUndefined();
  });

  it("does not load a list without a JWT", async () => {
    const listMacis = vi.fn();
    const store = createMaciInstancesStore({ listMacis });

    await store.getState().load(undefined, 1);
    await store.getState().load("", 1);

    expect(listMacis).not.toHaveBeenCalled();
    expect(store.getState().items).toEqual([]);
  });

  it("treats an empty list as zero pages", async () => {
    const store = createMaciInstancesStore({
      listMacis: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: MACI_LIST_PAGE_SIZE }),
    });

    await store.getState().load("jwt", 1);

    expect(store.getState().pageCount).toBe(0);
  });

  it("surfaces a list error", async () => {
    const store = createMaciInstancesStore({
      listMacis: vi.fn().mockRejectedValue(new Error("forbidden")),
    });

    await store.getState().load("jwt", 1);

    expect(store.getState().error).toBe("forbidden");
    expect(store.getState().items).toEqual([]);
  });

  it("surfaces a non-Error list failure", async () => {
    const store = createMaciInstancesStore({
      listMacis: vi.fn().mockRejectedValue("down"),
    });

    await store.getState().load("jwt", 1);

    expect(store.getState().error).toBe("MACI list failed");
  });

  it("ignores a stale list response", async () => {
    const later = {
      items: [{ address: "0x22", network: "starknet_local" as const, createdAtMs: 1_000_100 }],
      total: 1,
      page: 2,
      pageSize: MACI_LIST_PAGE_SIZE,
    };
    let resolveFirst: (page: typeof PAGE) => void = (): void => undefined;
    const listMacis = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<typeof PAGE>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce(later);
    const store = createMaciInstancesStore({ listMacis });
    const first = store.getState().load("jwt", 1);
    const second = store.getState().load("jwt", 2);

    await second;
    resolveFirst(PAGE);
    await first;

    expect(store.getState().items).toEqual(later.items);
  });

  it("ignores a stale list error", async () => {
    let rejectFirst: (reason: unknown) => void = (): void => undefined;
    const listMacis = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<typeof PAGE>((_resolve, reject) => {
            rejectFirst = reject;
          }),
      )
      .mockResolvedValueOnce(PAGE);
    const store = createMaciInstancesStore({ listMacis });
    const first = store.getState().load("jwt", 1);
    const second = store.getState().load("jwt", 1);

    await second;
    rejectFirst(new Error("forbidden"));
    await first;

    expect(store.getState().items).toEqual(PAGE.items);
    expect(store.getState().error).toBeUndefined();
  });

  it("resets list state", async () => {
    const store = createMaciInstancesStore({
      listMacis: vi.fn().mockResolvedValue(PAGE),
    });

    await store.getState().load("jwt", 1);
    store.getState().reset();

    expect(store.getState().items).toEqual([]);
    expect(store.getState().pageCount).toBe(0);
    expect(store.getState().generation).toBe(0);
  });
});
