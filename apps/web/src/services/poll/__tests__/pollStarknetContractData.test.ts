import { beforeEach, describe, expect, it, vi } from "vitest";

import { type StarknetRpcService } from "../../rpc";
import { PollStarknetContractData } from "../pollStarknetContractData.js";

describe("PollStarknetContractData", () => {
  const callContract = vi.fn();
  const rpc = { callContract } as unknown as StarknetRpcService;

  beforeEach(() => {
    callContract.mockReset();
  });

  it("reads ballot_count from the Poll contract", async () => {
    callContract.mockResolvedValue(["0x4"]);

    await expect(new PollStarknetContractData(rpc).read("local", "0xaa")).resolves.toEqual({
      ballotCount: "4",
    });
    expect(callContract).toHaveBeenCalledWith("local", {
      contractAddress: "0xaa",
      entrypoint: "ballot_count",
    });
  });

  it("throws when the contract returns no felt", async () => {
    callContract.mockResolvedValue([]);

    await expect(new PollStarknetContractData(rpc).read("local", "0xaa")).rejects.toThrow(/^Ballot count failed$/u);
  });
});
