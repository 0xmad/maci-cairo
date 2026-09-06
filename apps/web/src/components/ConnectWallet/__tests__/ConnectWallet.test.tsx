import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConnectWallet } from "..";
import { useConnectWallet } from "../useConnectWallet";

vi.mock("../useConnectWallet", () => ({
  useConnectWallet: vi.fn(),
}));

const useConnectWalletMock = vi.mocked(useConnectWallet);

describe("ConnectWallet", () => {
  const handleClick = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    handleClick.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the connected address", () => {
    useConnectWalletMock.mockReturnValue({
      address: "0xabc",
      handleClick,
    });

    render(<ConnectWallet />);

    expect(screen.getByText("Connected")).toBeTruthy();
    expect(screen.getByText("0xabc")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Connect" })).toBeNull();
  });

  it("shows a connect error toast that disappears after the error clears", () => {
    useConnectWalletMock.mockReturnValue({
      error: "No Argent or Braavos wallet found",
      handleClick,
    });

    const { rerender } = render(<ConnectWallet />);

    expect(screen.getByRole("status").textContent).toBe("No Argent or Braavos wallet found");

    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    expect(handleClick).toHaveBeenCalledTimes(1);

    useConnectWalletMock.mockReturnValue({
      handleClick,
    });
    rerender(<ConnectWallet />);

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.queryByRole("status")).toBeNull();
  });
});
