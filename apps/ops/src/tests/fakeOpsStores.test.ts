import { describe, expect, test } from "vitest";

import { fakeOpsStores } from "./fakeOpsStores.js";

describe("fakeOpsStores", () => {
  test("mergeCheckpoint without addresses stores an empty checkpoint", async () => {
    const { standup } = fakeOpsStores();

    await standup.mergeCheckpoint({});

    await expect(standup.readCheckpoint()).resolves.toBeUndefined();
  });

  test("job updates are ignored when no job exists", async () => {
    const { jobs } = fakeOpsStores();

    await jobs.fail("job-1", 1_000_000, "failed");

    await expect(jobs.latest()).resolves.toBeUndefined();
  });

  test("readCreatePoll is undefined when no attempt is stored", async () => {
    const { polls } = fakeOpsStores();

    await expect(polls.readCreatePoll("job-1")).resolves.toBeUndefined();
  });

  test("listPolls returns recorded Polls newest first", async () => {
    const { polls } = fakeOpsStores();

    await polls.recordPoll({
      maci: "0x7",
      address: "0xaa",
      pollId: "1",
      startDate: "0",
      endDate: "1000",
      pollPublicKey: ["0", "1"],
      createdAtMs: 1_000_100,
    });
    await polls.recordPoll({
      maci: "0x7",
      address: "0xbb",
      pollId: "2",
      startDate: "10",
      endDate: "20",
      pollPublicKey: ["3", "4"],
      createdAtMs: 1_000_200,
    });

    await expect(polls.listPolls("0x7", { page: 1, pageSize: 10 })).resolves.toEqual({
      total: 2,
      items: [
        {
          address: "0xbb",
          pollId: "2",
          startDate: "10",
          endDate: "20",
          pollPublicKey: ["3", "4"],
          createdAtMs: 1_000_200,
        },
        {
          address: "0xaa",
          pollId: "1",
          startDate: "0",
          endDate: "1000",
          pollPublicKey: ["0", "1"],
          createdAtMs: 1_000_100,
        },
      ],
    });
  });
});
