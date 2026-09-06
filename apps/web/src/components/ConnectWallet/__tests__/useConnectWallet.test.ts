import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { connectInjectedWallet } from "../../../services/wallet";
import { useConnectWallet } from "../useConnectWallet";

vi.mock("../../../services/wallet", () => ({
  connectInjectedWallet: vi.fn(),
}));

const connectInjectedWalletMock = vi.mocked(connectInjectedWallet);

describe("useConnectWallet", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    connectInjectedWalletMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sets the address after a successful connect", async () => {
    connectInjectedWalletMock.mockResolvedValue("0xabc");

    const { result } = renderHook(() => useConnectWallet());

    await act(async () => {
      await result.current.handleClick();
    });

    expect(result.current.address).toBe("0xabc");
    expect(result.current.error).toBeUndefined();
  });

  it("records a wallet Error message and clears it after 4 seconds", async () => {
    connectInjectedWalletMock.mockRejectedValue(new Error("No Argent or Braavos wallet found"));

    const { result } = renderHook(() => useConnectWallet());

    await act(async () => {
      await result.current.handleClick();
    });

    expect(result.current.address).toBeUndefined();
    expect(result.current.error).toBe("No Argent or Braavos wallet found");

    act(() => {
      vi.advanceTimersByTime(3999);
    });

    expect(result.current.error).toBe("No Argent or Braavos wallet found");

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(result.current.error).toBeUndefined();
  });

  it("uses Connect failed when the rejection is not an Error", async () => {
    connectInjectedWalletMock.mockRejectedValue("wallet unavailable");

    const { result } = renderHook(() => useConnectWallet());

    await act(async () => {
      await result.current.handleClick();
    });

    expect(result.current.error).toBe("Connect failed");
  });
});
