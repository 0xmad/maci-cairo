import { afterEach, describe, expect, it, vi } from "vitest";

import { connectInjectedWallet, findInjectedWallet, type InjectedWallet } from "..";

type WalletWindow = Window & {
  starknet_argentX?: InjectedWallet;
  starknet_braavos?: InjectedWallet;
};

const walletWindow = (): WalletWindow => window;

afterEach(() => {
  const w = walletWindow();

  delete w.starknet_argentX;
  delete w.starknet_braavos;
});

describe("findInjectedWallet", () => {
  it("prefers Argent over Braavos", () => {
    const argent: InjectedWallet = { selectedAddress: "0xargent" };
    const braavos: InjectedWallet = { selectedAddress: "0xbraavos" };

    walletWindow().starknet_argentX = argent;
    walletWindow().starknet_braavos = braavos;

    expect(findInjectedWallet()).toBe(argent);
  });

  it("uses Braavos when Argent is missing", () => {
    const braavos: InjectedWallet = { selectedAddress: "0xbraavos" };

    walletWindow().starknet_braavos = braavos;

    expect(findInjectedWallet()).toBe(braavos);
  });

  it("returns undefined when no injected wallet is present", () => {
    expect(findInjectedWallet()).toBeUndefined();
  });
});

describe("connectInjectedWallet", () => {
  it("throws when no Argent or Braavos wallet is found", async () => {
    await expect(connectInjectedWallet()).rejects.toThrow("No Argent or Braavos wallet found");
  });

  it("returns the first enable() account when it is a non-empty string", async () => {
    walletWindow().starknet_argentX = {
      enable: vi.fn().mockResolvedValue(["0xfrom-enable"]),
    };

    await expect(connectInjectedWallet()).resolves.toBe("0xfrom-enable");
  });

  it("returns a string enable() result", async () => {
    walletWindow().starknet_argentX = {
      enable: vi.fn().mockResolvedValue("0xsingle"),
    };

    await expect(connectInjectedWallet()).resolves.toBe("0xsingle");
  });

  it("requests accounts then uses selectedAddress when enable() has no address", async () => {
    const request = vi.fn().mockResolvedValue(undefined);

    walletWindow().starknet_argentX = {
      enable: vi.fn().mockResolvedValue([]),
      request,
      selectedAddress: "0xselected",
    };

    await expect(connectInjectedWallet()).resolves.toBe("0xselected");
    expect(request).toHaveBeenCalledWith({ type: "wallet_requestAccounts" });
  });

  it("uses account.address when selectedAddress is missing", async () => {
    walletWindow().starknet_braavos = {
      account: { address: "0xaccount" },
    };

    await expect(connectInjectedWallet()).resolves.toBe("0xaccount");
  });

  it("throws when the wallet connects without an address", async () => {
    walletWindow().starknet_argentX = {
      enable: vi.fn().mockResolvedValue([""]),
      request: vi.fn().mockResolvedValue(undefined),
      selectedAddress: "",
    };

    await expect(connectInjectedWallet()).rejects.toThrow("Wallet connected without an address");
  });
});
