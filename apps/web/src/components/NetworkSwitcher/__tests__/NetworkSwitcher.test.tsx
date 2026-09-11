import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NetworkSwitcher } from "..";
import { NetworkProvider } from "../../../providers/Network";

const { disconnectMock, switchChainMock } = vi.hoisted(() => ({
  disconnectMock: vi.fn(),
  switchChainMock: vi.fn(),
}));

vi.mock("../../../services/localStorage", () => ({
  storage: {
    clearStoredJwt: vi.fn(),
  },
}));

vi.mock("../../../services/wallet", () => ({
  wallet: {
    disconnect: disconnectMock,
    switchChain: switchChainMock,
  },
}));

const renderSwitcher = (): ReturnType<typeof render> =>
  render(
    <NetworkProvider>
      <NetworkSwitcher />
    </NetworkProvider>,
  );

const networkSelect = (): HTMLSelectElement => screen.getByRole("combobox", { name: "Network" });

describe("NetworkSwitcher", () => {
  beforeEach(() => {
    disconnectMock.mockReset();
    switchChainMock.mockReset();
    disconnectMock.mockResolvedValue(undefined);
    switchChainMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to local with the local RPC in the title", () => {
    renderSwitcher();

    const select = networkSelect();

    expect(select.value).toBe("local");
    expect(select.title).toBe(`${window.location.origin}/starknet-rpc`);
    expect(screen.getByRole("option", { name: "Local" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Sepolia" })).toHaveProperty("disabled", true);
  });

  it("does not switch to Sepolia", () => {
    renderSwitcher();

    const select = networkSelect();

    fireEvent.change(select, { target: { value: "sepolia" } });

    expect(select.value).toBe("local");
    expect(select.title).toBe(`${window.location.origin}/starknet-rpc`);
    expect(switchChainMock).not.toHaveBeenCalled();
  });

  it("switches from Sepolia to local", async () => {
    vi.stubEnv("VITE_NETWORK_ID", "sepolia");
    renderSwitcher();

    const select = networkSelect();

    expect(select.value).toBe("sepolia");

    fireEvent.change(select, { target: { value: "local" } });

    await waitFor(() => {
      expect(select.value).toBe("local");
    });
    expect(select.title).toBe(`${window.location.origin}/starknet-rpc`);
  });

  it("ignores a value that is not an app network", () => {
    renderSwitcher();

    const select = networkSelect();

    fireEvent.change(select, { target: { value: "mainnet" } });

    expect(select.value).toBe("local");
    expect(select.title).toBe(`${window.location.origin}/starknet-rpc`);
  });
});
