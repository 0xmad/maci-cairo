import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { JSX } from "react";
import type { StarkZap } from "starkzap";

import { Shell } from "..";
import { useNetwork } from "../../../providers/Network";

vi.mock("../../../components/ConnectWallet", () => ({
  ConnectWallet: (): JSX.Element => <div>ConnectWallet</div>,
}));

vi.mock("../../../components/NetworkSwitcher", () => ({
  NetworkSwitcher: (): JSX.Element => <div>NetworkSwitcher</div>,
}));

vi.mock("../../../providers/Network", () => ({
  useNetwork: vi.fn(),
}));

const useNetworkMock = vi.mocked(useNetwork);

const renderShell = (path: string): void => {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<Shell />}>
          <Route element={<p>outlet</p>} path="*" />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
};

describe("Shell", () => {
  beforeEach(() => {
    useNetworkMock.mockReturnValue({
      network: "local",
      sdk: {} as StarkZap,
      setNetwork: vi.fn(),
    });
  });

  it("renders nav, header controls, and the outlet without a MACI banner", () => {
    renderShell("/");

    expect(screen.getByRole("link", { name: "Deploy" }).getAttribute("href")).toBe("/");
    expect(screen.getByRole("link", { name: "MACI" }).getAttribute("href")).toBe("/maci");
    expect(screen.getByText("NetworkSwitcher")).toBeTruthy();
    expect(screen.getByText("ConnectWallet")).toBeTruthy();
    expect(screen.getByText("outlet")).toBeTruthy();
    expect(screen.queryByText(/Showing this MACI/)).toBeNull();
  });

  it("points MACI at the address in the URL and shows the network banner", () => {
    renderShell("/maci/0xabc");

    expect(screen.getByRole("link", { name: "MACI" }).getAttribute("href")).toBe("/maci/0xabc");
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
});
