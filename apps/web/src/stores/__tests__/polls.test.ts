import { describe, expect, it, vi } from "vitest";

import { createPollsStore, POLL_LIST_PAGE_SIZE } from "../polls.js";

const PAGE = {
  items: [
    {
      address: "0xaa",
      pollId: "2",
      startDate: "0",
      endDate: "1000",
      pollPublicKey: ["0", "1"] as [string, string],
      createdAtMs: 1_000_200,
    },
  ],
  total: 11,
  page: 1,
  pageSize: POLL_LIST_PAGE_SIZE,
};

describe("Polls store", () => {
  it("loads a Poll list page for a MACI", async () => {
    const listPolls = vi.fn().mockResolvedValue(PAGE);
    const store = createPollsStore({ listPolls });

    await store.getState().load("jwt", "0x7", 1);

    expect(listPolls).toHaveBeenCalledWith("jwt", "0x7", 1, 10);
    expect(store.getState().items).toEqual(PAGE.items);
    expect(store.getState().pageCount).toBe(2);
    expect(store.getState().error).toBeUndefined();
  });

  it("does not load without a JWT or MACI address", async () => {
    const listPolls = vi.fn();
    const store = createPollsStore({ listPolls });

    await store.getState().load(undefined, "0x7", 1);
    await store.getState().load("jwt", undefined, 1);
    await store.getState().load("jwt", "", 1);

    expect(listPolls).not.toHaveBeenCalled();
    expect(store.getState().items).toEqual([]);
  });

  it("surfaces a list error", async () => {
    const store = createPollsStore({
      listPolls: vi.fn().mockRejectedValue(new Error("forbidden")),
    });

    await store.getState().load("jwt", "0x7", 1);

    expect(store.getState().error).toBe("forbidden");
  });

  it("surfaces a non-Error list failure", async () => {
    const store = createPollsStore({
      listPolls: vi.fn().mockRejectedValue("down"),
    });

    await store.getState().load("jwt", "0x7", 1);

    expect(store.getState().error).toBe("Poll list failed");
  });

  it("treats an empty list as zero pages", async () => {
    const store = createPollsStore({
      listPolls: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: POLL_LIST_PAGE_SIZE }),
    });

    await store.getState().load("jwt", "0x7", 1);

    expect(store.getState().pageCount).toBe(0);
  });

  it("ignores a stale list response", async () => {
    const later = {
      items: [
        {
          address: "0xbb",
          pollId: "3",
          startDate: "0",
          endDate: "1000",
          pollPublicKey: ["0", "1"] as [string, string],
          createdAtMs: 1_000_200,
        },
      ],
      total: 1,
      page: 2,
      pageSize: POLL_LIST_PAGE_SIZE,
    };
    let resolveFirst: (page: typeof PAGE) => void = (): void => undefined;
    const listPolls = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<typeof PAGE>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce(later);
    const store = createPollsStore({ listPolls });
    const first = store.getState().load("jwt", "0x7", 1);
    const second = store.getState().load("jwt", "0x7", 2);

    await second;
    resolveFirst(PAGE);
    await first;

    expect(store.getState().items).toEqual(later.items);
  });

  it("ignores a stale list error", async () => {
    let rejectFirst: (reason: unknown) => void = (): void => undefined;
    const listPolls = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<typeof PAGE>((_resolve, reject) => {
            rejectFirst = reject;
          }),
      )
      .mockResolvedValueOnce(PAGE);
    const store = createPollsStore({ listPolls });
    const first = store.getState().load("jwt", "0x7", 1);
    const second = store.getState().load("jwt", "0x7", 1);

    await second;
    rejectFirst(new Error("forbidden"));
    await first;

    expect(store.getState().items).toEqual(PAGE.items);
    expect(store.getState().error).toBeUndefined();
  });

  it("resets poll list state", async () => {
    const store = createPollsStore({
      listPolls: vi.fn().mockResolvedValue(PAGE),
    });

    await store.getState().load("jwt", "0x7", 1);
    store.getState().reset();

    expect(store.getState().items).toEqual([]);
    expect(store.getState().pageCount).toBe(0);
    expect(store.getState().generation).toBe(0);
  });
});
