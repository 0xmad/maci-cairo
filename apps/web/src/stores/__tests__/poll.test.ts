import { describe, expect, it, vi } from "vitest";

import { createPollStore, type PollContractDataApi } from "../poll.js";

const POLL = {
  address: "0xaa",
  pollId: "2",
  startDate: "0",
  endDate: "1000",
  pollPublicKey: ["0", "1"] as [string, string],
  createdAtMs: 1_000_200,
  maci: "0x7",
};

function contractData(ballotCount = "4"): PollContractDataApi {
  return { read: vi.fn().mockResolvedValue({ ballotCount }) };
}

describe("Poll store", () => {
  it("loads Poll data for a Poll address", async () => {
    const readPoll = vi.fn().mockResolvedValue(POLL);
    const read = vi.fn().mockResolvedValue({ ballotCount: "4" });
    const store = createPollStore({ readPoll }, { read });

    await store.getState().loadPollData("jwt", "0xaa", "local");

    expect(readPoll).toHaveBeenCalledWith("jwt", "0xaa");
    expect(read).toHaveBeenCalledWith("local", "0xaa");
    expect(store.getState().poll).toEqual(POLL);
    expect(store.getState().ballotCount).toBe("4");
    expect(store.getState().error).toBeUndefined();
  });

  it("does not load without a JWT, Poll address, or network", async () => {
    const readPoll = vi.fn();
    const read = vi.fn();
    const store = createPollStore({ readPoll }, { read });

    await store.getState().loadPollData(undefined, "0xaa", "local");
    await store.getState().loadPollData("", "0xaa", "local");
    await store.getState().loadPollData("jwt", undefined, "local");
    await store.getState().loadPollData("jwt", "", "local");
    await store.getState().loadPollData("jwt", "0xaa", undefined);

    expect(readPoll).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
    expect(store.getState().poll).toBeUndefined();
  });

  it("surfaces a missing Poll as an error", async () => {
    const store = createPollStore(
      {
        readPoll: vi.fn().mockRejectedValue(new Error("poll not found")),
      },
      contractData(),
    );

    await store.getState().loadPollData("jwt", "0xaa", "local");

    expect(store.getState().error).toBe("poll not found");
    expect(store.getState().poll).toBeUndefined();
    expect(store.getState().ballotCount).toBeUndefined();
  });

  it("surfaces a non-Error Poll failure", async () => {
    const store = createPollStore(
      {
        readPoll: vi.fn().mockRejectedValue("down"),
      },
      contractData(),
    );

    await store.getState().loadPollData("jwt", "0xaa", "local");

    expect(store.getState().error).toBe("Poll failed");
  });

  it("ignores a stale Poll response", async () => {
    const later = { ...POLL, address: "0xbb" };
    let resolveFirst: (poll: typeof POLL) => void = (): void => undefined;
    const readPoll = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<typeof POLL>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce(later);
    const store = createPollStore({ readPoll }, contractData("9"));
    const first = store.getState().loadPollData("jwt", "0xaa", "local");
    const second = store.getState().loadPollData("jwt", "0xbb", "local");

    await second;
    resolveFirst(POLL);
    await first;

    expect(store.getState().poll).toEqual(later);
    expect(store.getState().ballotCount).toBe("9");
  });

  it("ignores a stale Poll error", async () => {
    let rejectFirst: (reason: unknown) => void = (): void => undefined;
    const readPoll = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<typeof POLL>((_resolve, reject) => {
            rejectFirst = reject;
          }),
      )
      .mockResolvedValueOnce(POLL);
    const store = createPollStore({ readPoll }, contractData());
    const first = store.getState().loadPollData("jwt", "0xaa", "local");
    const second = store.getState().loadPollData("jwt", "0xaa", "local");

    await second;
    rejectFirst(new Error("poll not found"));
    await first;

    expect(store.getState().poll).toEqual(POLL);
    expect(store.getState().error).toBeUndefined();
  });

  it("ignores stale contract data", async () => {
    const later = { ...POLL, address: "0xbb" };
    let resolveFirst: (data: { ballotCount: string }) => void = (): void => undefined;
    let firstContractStarted: () => void = (): void => undefined;
    const started = new Promise<void>((resolve) => {
      firstContractStarted = resolve;
    });
    const store = createPollStore(
      { readPoll: vi.fn().mockResolvedValueOnce(POLL).mockResolvedValueOnce(later) },
      {
        read: vi
          .fn()
          .mockImplementationOnce(
            () =>
              new Promise<{ ballotCount: string }>((resolve) => {
                firstContractStarted();
                resolveFirst = resolve;
              }),
          )
          .mockResolvedValueOnce({ ballotCount: "9" }),
      },
    );
    const first = store.getState().loadPollData("jwt", "0xaa", "local");

    await started;

    const second = store.getState().loadPollData("jwt", "0xbb", "local");

    await second;
    resolveFirst({ ballotCount: "1" });
    await first;

    expect(store.getState().poll).toEqual(later);
    expect(store.getState().ballotCount).toBe("9");
  });

  it("ignores a stale contract failure", async () => {
    let rejectFirst: (reason: unknown) => void = (): void => undefined;
    let firstContractStarted: () => void = (): void => undefined;
    const started = new Promise<void>((resolve) => {
      firstContractStarted = resolve;
    });
    const store = createPollStore(
      { readPoll: vi.fn().mockResolvedValue(POLL) },
      {
        read: vi
          .fn()
          .mockImplementationOnce(
            () =>
              new Promise<{ ballotCount: string }>((_resolve, reject) => {
                firstContractStarted();
                rejectFirst = reject;
              }),
          )
          .mockResolvedValueOnce({ ballotCount: "9" }),
      },
    );
    const first = store.getState().loadPollData("jwt", "0xaa", "local");

    await started;

    const second = store.getState().loadPollData("jwt", "0xaa", "local");

    await second;
    rejectFirst(new Error("Ballot count failed"));
    await first;

    expect(store.getState().poll).toEqual(POLL);
    expect(store.getState().ballotCount).toBe("9");
  });

  it("keeps the Poll when contract data fails", async () => {
    const store = createPollStore(
      { readPoll: vi.fn().mockResolvedValue(POLL) },
      { read: vi.fn().mockRejectedValue(new Error("Ballot count failed")) },
    );

    await store.getState().loadPollData("jwt", "0xaa", "local");

    expect(store.getState().poll).toEqual(POLL);
    expect(store.getState().ballotCount).toBeUndefined();
    expect(store.getState().error).toBeUndefined();
  });

  it("resets Poll state", async () => {
    const store = createPollStore({ readPoll: vi.fn().mockResolvedValue(POLL) }, contractData());

    await store.getState().loadPollData("jwt", "0xaa", "local");
    store.getState().reset();

    expect(store.getState().poll).toBeUndefined();
    expect(store.getState().ballotCount).toBeUndefined();
    expect(store.getState().generation).toBe(0);
  });
});
