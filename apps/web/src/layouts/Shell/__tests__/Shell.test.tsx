import { render, screen } from "@testing-library/react";
import { type JSX } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { StarkZap } from "starkzap";

import { Shell } from "..";
import { useNetwork } from "../../../providers/Network";

const { connectWalletMounts } = vi.hoisted(() => ({
  connectWalletMounts: { count: 0 },
}));

vi.mock("../../../components/ConnectWallet", async () => {
  const { useEffect } = await import("react");

  return {
    ConnectWallet: (): JSX.Element => {
      useEffect(() => {
        connectWalletMounts.count += 1;
      }, []);

      return <div>ConnectWallet</div>;
    },
  };
});

vi.mock("../../../components/NetworkSwitcher", () => ({
  NetworkSwitcher: (): JSX.Element => <div>NetworkSwitcher</div>,
}));

vi.mock("../../../providers/Network", () => ({
  useNetwork: vi.fn(),
}));

const useNetworkMock = vi.mocked(useNetwork);

const shellTree = (path: string): JSX.Element => (
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route element={<Shell />}>
        <Route element={<p>outlet</p>} path="*" />
      </Route>
    </Routes>
  </MemoryRouter>
);

const renderShell = (path: string): ReturnType<typeof render> => render(shellTree(path));

describe("Shell", () => {
  beforeEach(() => {
    connectWalletMounts.count = 0;
    useNetworkMock.mockReturnValue({
      network: "local",
      sdk: {} as StarkZap,
      setNetwork: vi.fn(),
    });
  });

  it("renders nav, header controls, and the outlet without a MACI banner", () => {
    renderShell("/");

    expect(screen.getByRole("link", { name: "Deploy" }).getAttribute("href")).toBe("/");
    expect(screen.queryByRole("link", { name: "MACI" })).toBeNull();
    expect(screen.getByText("NetworkSwitcher")).toBeTruthy();
    expect(screen.getByText("ConnectWallet")).toBeTruthy();
    expect(screen.getByText("outlet")).toBeTruthy();
    expect(screen.queryByText(/Showing this MACI/)).toBeNull();
  });

  it("shows the network banner on a MACI instance page", () => {
    renderShell("/maci/0xabc");

    expect(screen.queryByRole("link", { name: "MACI" })).toBeNull();
    expect(screen.getByText("Showing this MACI on local. Contract addresses are network-specific.")).toBeTruthy();
  });

  it("uses the selected network in the MACI banner", () => {
    useNetworkMock.mockReturnValue({
      network: "sepolia",
      sdk: {} as StarkZap,
      setNetwork: vi.fn(),
    });

    renderShell("/maci/0xabc");

    expect(screen.getByText("Showing this MACI on sepolia. Contract addresses are network-specific.")).toBeTruthy();
  });

  it("remounts ConnectWallet when the selected network changes", () => {
    const view = renderShell("/");

    expect(connectWalletMounts.count).toBe(1);

    useNetworkMock.mockReturnValue({
      network: "sepolia",
      sdk: {} as StarkZap,
      setNetwork: vi.fn(),
    });
    view.rerender(shellTree("/"));

    expect(connectWalletMounts.count).toBe(2);
  });
});
