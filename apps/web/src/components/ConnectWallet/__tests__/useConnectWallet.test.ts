import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useConnectWallet } from "../useConnectWallet";

const { connectMock, disconnectMock } = vi.hoisted(() => ({
  connectMock: vi.fn(),
  disconnectMock: vi.fn(),
}));

vi.mock("../../../providers/Network", () => ({
  useNetwork: (): { network: "local" } => ({
    network: "local",
  }),
}));

vi.mock("../../../services/wallet", () => ({
  wallet: {
    connect: connectMock,
    disconnect: disconnectMock,
  },
}));

describe("useConnectWallet", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    connectMock.mockReset();
    disconnectMock.mockReset();
    disconnectMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sets the address after a successful connect", async () => {
    connectMock.mockResolvedValue("0xabc");

    const { result } = renderHook(() => useConnectWallet());

    await act(async () => {
      await result.current.handleClick();
    });

    expect(result.current.address).toBe("0xabc");
    expect(result.current.error).toBeUndefined();
  });

  it("records a wallet Error message and clears it after 4 seconds", async () => {
    connectMock.mockRejectedValue(new Error("No wallet selected"));

    const { result } = renderHook(() => useConnectWallet());

    await act(async () => {
      await result.current.handleClick();
    });

    expect(result.current.address).toBeUndefined();
    expect(result.current.error).toBe("No wallet selected");

    act(() => {
      vi.advanceTimersByTime(3999);
    });

    expect(result.current.error).toBe("No wallet selected");

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(result.current.error).toBeUndefined();
  });

  it("uses Connect failed when the rejection is not an Error", async () => {
    connectMock.mockRejectedValue("wallet unavailable");

    const { result } = renderHook(() => useConnectWallet());

    await act(async () => {
      await result.current.handleClick();
    });

    expect(result.current.error).toBe("Connect failed");
  });

  it("clears the connected address on disconnect", async () => {
    connectMock.mockResolvedValue("0xabc");

    const { result } = renderHook(() => useConnectWallet());

    await act(async () => {
      await result.current.handleClick();
    });

    await act(async () => {
      await result.current.disconnect();
    });

    expect(result.current.address).toBeUndefined();
    expect(disconnectMock).toHaveBeenCalledTimes(1);
  });
});
