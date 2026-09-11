import { beforeEach, describe, expect, it, vi } from "vitest";

import { Wallet } from "..";
import { operatorNonceMessage } from "../../ops/nonceMessage";

const { connectMock, disconnectMock, walletAccountConnectMock } = vi.hoisted(() => ({
  connectMock: vi.fn(),
  disconnectMock: vi.fn(),
  walletAccountConnectMock: vi.fn(),
}));

vi.mock("@starknet-io/get-starknet", () => ({
  connect: connectMock,
  disconnect: disconnectMock,
}));

vi.mock("starknet", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("starknet");

  return {
    ...actual,
    WalletAccount: {
      connect: walletAccountConnectMock,
    },
  };
});

const RPC_URL = "http://rpc.test/";
const selectedWallet = { id: "argentX" };

describe("Wallet", () => {
  beforeEach(() => {
    connectMock.mockReset();
    disconnectMock.mockReset();
    walletAccountConnectMock.mockReset();
  });

  it("connects with get-starknet and returns the WalletAccount address", async () => {
    connectMock.mockResolvedValue(selectedWallet);
    walletAccountConnectMock.mockResolvedValue({ address: "0xabc" });

    await expect(new Wallet().connect(RPC_URL)).resolves.toBe("0xabc");
    expect(connectMock).toHaveBeenCalledWith({ modalMode: "alwaysAsk", exclude: ["metamask"] });
    expect(walletAccountConnectMock).toHaveBeenCalledWith({ nodeUrl: RPC_URL }, selectedWallet);
  });

  it("throws when the user does not select a wallet", async () => {
    connectMock.mockResolvedValue(null);

    await expect(new Wallet().connect(RPC_URL)).rejects.toThrow("No wallet selected");
    expect(walletAccountConnectMock).not.toHaveBeenCalled();
  });

  it("throws when the connected account has no address", async () => {
    connectMock.mockResolvedValue(selectedWallet);
    walletAccountConnectMock.mockResolvedValue({ address: "" });

    await expect(new Wallet().connect(RPC_URL)).rejects.toThrow("Wallet connected without an address");
  });

  it("signs SNIP-12 typed data with the last connected wallet", async () => {
    const typedData = operatorNonceMessage("nonce-1", "0x534e5f5345504f4c4941");
    const signMessage = vi.fn().mockResolvedValue(["0x1", "0x2"]);

    connectMock.mockResolvedValue(selectedWallet);
    walletAccountConnectMock.mockResolvedValue({ address: "0xabc", signMessage });

    await expect(new Wallet().signMessage(RPC_URL, typedData)).resolves.toEqual(["0x1", "0x2"]);
    expect(connectMock).toHaveBeenCalledWith({ modalMode: "neverAsk", exclude: ["metamask"] });
    expect(signMessage).toHaveBeenCalledWith(typedData);
  });

  it("throws when signing without a connected wallet", async () => {
    connectMock.mockResolvedValue(null);

    await expect(
      new Wallet().signMessage(RPC_URL, operatorNonceMessage("nonce-1", "0x534e5f5345504f4c4941")),
    ).rejects.toThrow("No wallet connected");
  });

  it("disconnects the last wallet", async () => {
    disconnectMock.mockResolvedValue(undefined);

    await expect(new Wallet().disconnect()).resolves.toBeUndefined();
    expect(disconnectMock).toHaveBeenCalledWith({ clearLastWallet: true });
  });

  it("asks the connected wallet to switch Starknet chain", async () => {
    const request = vi.fn().mockResolvedValue(true);

    connectMock.mockResolvedValue({ ...selectedWallet, request });

    await expect(new Wallet().switchChain("0x534e5f5345504f4c4941")).resolves.toBeUndefined();
    expect(connectMock).toHaveBeenCalledWith({ modalMode: "neverAsk", exclude: ["metamask"] });
    expect(request).toHaveBeenCalledWith({
      type: "wallet_switchStarknetChain",
      params: { chainId: "0x534e5f5345504f4c4941" },
    });
  });

  it("does not request a chain switch when no wallet is connected", async () => {
    connectMock.mockResolvedValue(null);

    await expect(new Wallet().switchChain("0x534e5f5345504f4c4941")).resolves.toBeUndefined();
  });

  it("propagates a wallet_switchStarknetChain rejection", async () => {
    const request = vi.fn().mockRejectedValue(new Error("unlisted network"));

    connectMock.mockResolvedValue({ ...selectedWallet, request });

    await expect(new Wallet().switchChain("0x534e5f5345504f4c4941")).rejects.toThrow("unlisted network");
  });
});
