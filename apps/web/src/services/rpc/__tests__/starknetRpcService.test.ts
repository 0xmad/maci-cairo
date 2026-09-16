import { RpcProvider } from "starknet";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StarknetRpcService } from "..";

vi.mock("starknet", () => ({
  RpcProvider: vi.fn(),
}));

const RpcProviderMock = vi.mocked(RpcProvider);

const URLS = {
  local: "http://local.rpc.test/",
  sepolia: "http://sepolia.rpc.test/",
};

describe("StarknetRpcService", () => {
  const localCall = vi.fn();
  const sepoliaCall = vi.fn();

  beforeEach(() => {
    localCall.mockReset();
    sepoliaCall.mockReset();
    RpcProviderMock.mockReset();
    RpcProviderMock.mockImplementation(
      class {
        callContract: ReturnType<typeof vi.fn>;

        constructor(options: { nodeUrl: string }) {
          this.callContract = options.nodeUrl === URLS.sepolia ? sepoliaCall : localCall;
        }
      } as unknown as typeof RpcProvider,
    );
  });

  it("calls the contract on the selected Starknet network RPC", async () => {
    localCall.mockResolvedValue(["0x4"]);
    sepoliaCall.mockResolvedValue(["0x5"]);
    const rpc = new StarknetRpcService(URLS);

    await expect(rpc.callContract("local", { contractAddress: "0xaa", entrypoint: "ballot_count" })).resolves.toEqual([
      "0x4",
    ]);
    expect(RpcProviderMock).toHaveBeenCalledWith({ nodeUrl: URLS.local });
    expect(RpcProviderMock).toHaveBeenCalledWith({ nodeUrl: URLS.sepolia });
    expect(localCall).toHaveBeenCalledWith({
      contractAddress: "0xaa",
      entrypoint: "ballot_count",
    });
    expect(sepoliaCall).not.toHaveBeenCalled();

    await expect(rpc.callContract("sepolia", { contractAddress: "0xbb", entrypoint: "ballot_count" })).resolves.toEqual(
      ["0x5"],
    );
    expect(sepoliaCall).toHaveBeenCalledWith({
      contractAddress: "0xbb",
      entrypoint: "ballot_count",
    });
  });
});
