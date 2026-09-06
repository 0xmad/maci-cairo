import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { JSX, ReactNode } from "react";
import type { StarkZap } from "starkzap";

import { NetworkProvider, useNetwork } from "..";
import { createSdk, defaultNetwork, type AppNetwork } from "../../../config/network";

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

  it("rebuilds the sdk when the network changes", () => {
    const { result } = renderHook(() => useNetwork(), { wrapper });

    act(() => {
      result.current.setNetwork("sepolia");
    });

    expect(result.current.network).toBe("sepolia");
    expect(result.current.sdk).toEqual({ id: "sepolia" });
    expect(createSdkMock).toHaveBeenCalledWith("sepolia");
  });

  it("uses sepolia when that is the default network", () => {
    defaultNetworkMock.mockReturnValue("sepolia");

    const { result } = renderHook(() => useNetwork(), { wrapper });

    expect(result.current.network).toBe("sepolia");
    expect(createSdkMock).toHaveBeenCalledWith("sepolia");
  });
});
