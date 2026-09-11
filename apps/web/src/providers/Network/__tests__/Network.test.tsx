import { act, renderHook } from "@testing-library/react";
import { constants } from "starknet";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { JSX, ReactNode } from "react";
import type { StarkZap } from "starkzap";

import { NetworkProvider, useNetwork } from "..";
import { createSdk, defaultNetwork, type AppNetwork } from "../../../config/network";

const { clearStoredJwtMock, disconnectMock, switchChainMock } = vi.hoisted(() => ({
  clearStoredJwtMock: vi.fn(),
  disconnectMock: vi.fn(),
  switchChainMock: vi.fn(),
}));

vi.mock("../../../services/localStorage", () => ({
  storage: {
    clearStoredJwt: clearStoredJwtMock,
  },
}));

vi.mock("../../../services/wallet", () => ({
  wallet: {
    disconnect: disconnectMock,
    switchChain: switchChainMock,
  },
}));

vi.mock("../../../config/network", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("../../../config/network");

  return {
    ...actual,
    createSdk: vi.fn(),
    defaultNetwork: vi.fn(),
  };
});

const createSdkMock = vi.mocked(createSdk);
const defaultNetworkMock = vi.mocked(defaultNetwork);

const wrapper = ({ children }: { children: ReactNode }): JSX.Element => <NetworkProvider>{children}</NetworkProvider>;

describe("useNetwork", () => {
  beforeEach(() => {
    createSdkMock.mockReset();
    clearStoredJwtMock.mockReset();
    disconnectMock.mockReset();
    switchChainMock.mockReset();
    disconnectMock.mockResolvedValue(undefined);
    switchChainMock.mockResolvedValue(undefined);
    defaultNetworkMock.mockReturnValue("local");
    createSdkMock.mockImplementation((network: AppNetwork) => ({ id: network }) as unknown as StarkZap);
  });

  it("throws when used outside NetworkProvider", () => {
    expect(() => {
      renderHook(() => useNetwork());
    }).toThrow("useNetwork must be used within NetworkProvider");
  });

  it("exposes the default network and its sdk", () => {
    const { result } = renderHook(() => useNetwork(), { wrapper });

    expect(result.current.network).toBe("local");
    expect(result.current.sdk).toEqual({ id: "local" });
    expect(createSdkMock).toHaveBeenCalledWith("local");
  });

  it("rebuilds the sdk when the network changes", async () => {
    const { result } = renderHook(() => useNetwork(), { wrapper });

    await act(async () => {
      await result.current.setNetwork("sepolia");
    });

    expect(result.current.network).toBe("sepolia");
    expect(result.current.sdk).toEqual({ id: "sepolia" });
    expect(createSdkMock).toHaveBeenCalledWith("sepolia");
    expect(switchChainMock).toHaveBeenCalledWith(constants.StarknetChainId.SN_SEPOLIA);
    expect(clearStoredJwtMock).toHaveBeenCalledTimes(1);
    expect(disconnectMock).toHaveBeenCalledTimes(1);
  });

  it("does not clear the Operator session when the network is unchanged", async () => {
    const { result } = renderHook(() => useNetwork(), { wrapper });

    await act(async () => {
      await result.current.setNetwork("local");
    });

    expect(clearStoredJwtMock).not.toHaveBeenCalled();
    expect(disconnectMock).not.toHaveBeenCalled();
    expect(createSdkMock).toHaveBeenCalledTimes(1);
  });

  it("switches the dapp network when wallet_switchStarknetChain rejects", async () => {
    switchChainMock.mockRejectedValue(new Error("user refused"));

    const { result } = renderHook(() => useNetwork(), { wrapper });

    await act(async () => {
      await result.current.setNetwork("sepolia");
    });

    expect(result.current.network).toBe("sepolia");
    expect(clearStoredJwtMock).toHaveBeenCalledTimes(1);
    expect(disconnectMock).toHaveBeenCalledTimes(1);
  });

  it("switches the dapp network when wallet disconnect rejects", async () => {
    disconnectMock.mockRejectedValue(new Error("wallet busy"));

    const { result } = renderHook(() => useNetwork(), { wrapper });

    await act(async () => {
      await result.current.setNetwork("sepolia");
    });

    expect(result.current.network).toBe("sepolia");
    expect(switchChainMock).toHaveBeenCalledTimes(1);
  });

  it("uses sepolia when that is the default network", () => {
    defaultNetworkMock.mockReturnValue("sepolia");

    const { result } = renderHook(() => useNetwork(), { wrapper });

    expect(result.current.network).toBe("sepolia");
    expect(createSdkMock).toHaveBeenCalledWith("sepolia");
  });
});
