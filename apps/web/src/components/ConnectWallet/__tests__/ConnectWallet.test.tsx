import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConnectWallet } from "..";
import { useConnectWallet } from "../useConnectWallet";
import { useOperatorLogin } from "../useOperatorLogin";

vi.mock("../useConnectWallet", () => ({
  useConnectWallet: vi.fn(),
}));

vi.mock("../useOperatorLogin", () => ({
  useOperatorLogin: vi.fn(),
}));

const useConnectWalletMock = vi.mocked(useConnectWallet);
const useOperatorLoginMock = vi.mocked(useOperatorLogin);

describe("ConnectWallet", () => {
  const handleClick = vi.fn();
  const signIn = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    handleClick.mockReset();
    signIn.mockReset();
    useOperatorLoginMock.mockReturnValue({
      restoring: false,
      signIn,
      signOut: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows Sign in as Operator after the wallet is connected", () => {
    useConnectWalletMock.mockReturnValue({
      address: "0xabc",
      handleClick,
      disconnect: vi.fn(),
    });

    render(<ConnectWallet />);

    expect(screen.getByRole("button", { name: "Sign in as Operator" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Connect" })).toBeNull();
  });

  it("shows a skeleton while the Operator session is restoring", () => {
    useConnectWalletMock.mockReturnValue({
      handleClick,
      disconnect: vi.fn(),
    });
    useOperatorLoginMock.mockReturnValue({
      restoring: true,
      signIn,
      signOut: vi.fn(),
    });

    render(<ConnectWallet />);

    expect(screen.getByRole("status", { name: "Restoring Operator" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Connect" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sign in as Operator" })).toBeNull();
  });

  it("swallows a rejected Operator sign-in", async () => {
    signIn.mockRejectedValue(new Error("user rejected"));
    useConnectWalletMock.mockReturnValue({
      address: "0xabc",
      handleClick,
      disconnect: vi.fn(),
    });

    render(<ConnectWallet />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Sign in as Operator" }));
      await Promise.resolve();
    });

    expect(signIn).toHaveBeenCalledTimes(1);
  });

  it("shows a shortened Operator address, the full address on hover, and Disconnect", () => {
    const operator = "0x064b48806902a367c8598f4f95c305e8c1a1acba5f082d294a43793113115691";
    const signOut = vi.fn();
    const disconnect = vi.fn().mockResolvedValue(undefined);

    useConnectWalletMock.mockReturnValue({
      address: "0xwallet",
      handleClick,
      disconnect,
    });
    useOperatorLoginMock.mockReturnValue({
      operator,
      restoring: false,
      signIn,
      signOut,
    });

    render(<ConnectWallet />);

    const shortened = screen.getByText("0x064b…5691");

    expect(screen.getByText("Operator")).toBeTruthy();
    expect(shortened.getAttribute("title")).toBe(operator);
    expect(screen.queryByText(operator)).toBeNull();
    expect(screen.getByRole("button", { name: "Disconnect" })).toBeTruthy();
  });

  it("shows a short Operator address in full", () => {
    useConnectWalletMock.mockReturnValue({
      address: "0xwallet",
      handleClick,
      disconnect: vi.fn().mockResolvedValue(undefined),
    });
    useOperatorLoginMock.mockReturnValue({
      operator: "0xoperator",
      restoring: false,
      signIn,
      signOut: vi.fn(),
    });

    render(<ConnectWallet />);

    const shown = screen.getByText("0xoperator");

    expect(shown.getAttribute("title")).toBe("0xoperator");
  });

  it("disconnects the Operator session and wallet", () => {
    const signOut = vi.fn();
    const disconnect = vi.fn().mockResolvedValue(undefined);

    useConnectWalletMock.mockReturnValue({
      address: "0xwallet",
      handleClick,
      disconnect,
    });
    useOperatorLoginMock.mockReturnValue({
      operator: "0x064b48806902a367c8598f4f95c305e8c1a1acba5f082d294a43793113115691",
      restoring: false,
      signIn,
      signOut,
    });

    render(<ConnectWallet />);
    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it("swallows a rejected wallet disconnect", async () => {
    const signOut = vi.fn();
    const disconnect = vi.fn().mockRejectedValue(new Error("wallet busy"));

    useConnectWalletMock.mockReturnValue({
      address: "0xwallet",
      handleClick,
      disconnect,
    });
    useOperatorLoginMock.mockReturnValue({
      operator: "0xoperator",
      restoring: false,
      signIn,
      signOut,
    });

    render(<ConnectWallet />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));
      await Promise.resolve();
    });

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it("shows a connect error toast that disappears after the error clears", () => {
    useConnectWalletMock.mockReturnValue({
      error: "No Argent or Braavos wallet found",
      handleClick,
      disconnect: vi.fn(),
    });

    const { rerender } = render(<ConnectWallet />);

    expect(screen.getByRole("status").textContent).toBe("No Argent or Braavos wallet found");

    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    expect(handleClick).toHaveBeenCalledTimes(1);

    useConnectWalletMock.mockReturnValue({
      handleClick,
      disconnect: vi.fn(),
    });
    rerender(<ConnectWallet />);

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.queryByRole("status")).toBeNull();
  });
});
