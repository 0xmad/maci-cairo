import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type JSX } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DeployPage } from "..";
import { useStandUpCatalog } from "../useStandUpCatalog";

vi.mock("../useStandUpCatalog", () => ({
  useStandUpCatalog: vi.fn(),
}));

const useStandUpCatalogMock = vi.mocked(useStandUpCatalog);

const startStandUp = vi.fn();

const CATALOG = {
  circuitProfiles: [{ id: "small", maxSignups: 32, maxVoteOptions: 5 }],
  policies: [{ id: "Free for all" }],
  assigners: [{ id: "Constant vote balance" }],
};

const DeployApp = (): JSX.Element => (
  <MemoryRouter initialEntries={["/deploy"]}>
    <Routes>
      <Route element={<DeployPage />} path="/deploy" />

      <Route element={<p>home</p>} path="/" />
    </Routes>
  </MemoryRouter>
);

describe("Deploy page", () => {
  beforeEach(() => {
    startStandUp.mockReset();
    startStandUp.mockResolvedValue(undefined);
    useStandUpCatalogMock.mockReturnValue({
      signedIn: false,
      starting: false,
      running: false,
      startStandUp,
    });
  });

  it("asks an unsigned-in visitor to sign in as Operator", () => {
    render(
      <MemoryRouter>
        <DeployPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Sign in as Operator to start MACI stand-up.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Start MACI stand-up" })).toBeNull();
    expect(screen.queryByLabelText("Circuit profile")).toBeNull();
    expect(screen.getByText(/Your wallet is only used to sign in/u)).toBeTruthy();
    expect(screen.queryByText(/Checker/iu)).toBeNull();
    expect(screen.queryByText(/Enforcer/iu)).toBeNull();
  });

  it("shows a catalog error to a signed-in Operator without the stand-up form", () => {
    useStandUpCatalogMock.mockReturnValue({
      signedIn: true,
      starting: false,
      running: false,
      error: "catalog failed",
      startStandUp,
    });

    render(
      <MemoryRouter>
        <DeployPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("catalog failed")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Start MACI stand-up" })).toBeNull();
    expect(screen.queryByLabelText("Circuit profile")).toBeNull();
  });

  it("does not show the stand-up form until the catalog is loaded", () => {
    useStandUpCatalogMock.mockReturnValue({
      signedIn: true,
      starting: false,
      running: false,
      startStandUp,
    });

    render(
      <MemoryRouter>
        <DeployPage />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("button", { name: "Start MACI stand-up" })).toBeNull();
    expect(screen.queryByLabelText("Circuit profile")).toBeNull();
  });

  it("shows catalog selectors and read-only Max Signups and Max vote options", () => {
    useStandUpCatalogMock.mockReturnValue({
      signedIn: true,
      starting: false,
      running: false,
      catalog: CATALOG,
      startStandUp,
    });

    render(
      <MemoryRouter>
        <DeployPage />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText("Circuit profile")).toBeTruthy();
    expect(screen.getByRole("option", { name: "small" })).toBeTruthy();
    expect(screen.getByLabelText("Policy")).toBeTruthy();
    expect(screen.getByRole("option", { name: "Free for all" })).toBeTruthy();
    expect(screen.getByLabelText("Vote balance assigner")).toBeTruthy();
    expect(screen.getByRole("option", { name: "Constant vote balance" })).toBeTruthy();
    expect(screen.getByLabelText("Constant amount")).toHaveProperty("value", "3");
    expect(screen.getByText("Max Signups")).toBeTruthy();
    expect(screen.getByText("32")).toBeTruthy();
    expect(screen.getByText("Max vote options")).toBeTruthy();
    expect(screen.getByText("5")).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "Max Signups" })).toBeNull();
    expect(screen.queryByRole("spinbutton", { name: "Max Signups" })).toBeNull();
    expect(screen.queryByText(/Checker/iu)).toBeNull();
    expect(screen.queryByText(/Enforcer/iu)).toBeNull();
  });

  it("starts MACI stand-up with the selected catalog body and stays on Deploy while the job runs", async () => {
    useStandUpCatalogMock.mockReturnValue({
      signedIn: true,
      starting: false,
      running: false,
      catalog: CATALOG,
      startStandUp,
    });

    render(<DeployApp />);

    fireEvent.change(screen.getByLabelText("Constant amount"), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "Start MACI stand-up" }));

    await waitFor(() => {
      expect(startStandUp).toHaveBeenCalledWith({
        circuitProfile: "small",
        policy: "Free for all",
        assigner: "Constant vote balance",
        voteBalance: 7,
      });
    });
    expect(screen.queryByText("home")).toBeNull();
    expect(screen.getByRole("button", { name: "Start MACI stand-up" })).toBeTruthy();
  });

  it("does not start stand-up when the constant amount is not a positive integer", async () => {
    useStandUpCatalogMock.mockReturnValue({
      signedIn: true,
      starting: false,
      running: false,
      catalog: CATALOG,
      startStandUp,
    });

    render(
      <MemoryRouter>
        <DeployPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Constant amount"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Start MACI stand-up" }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toBe("Constant amount must be a positive integer");
    });
    expect(startStandUp).not.toHaveBeenCalled();
  });

  it("returns to Home when Back is used", () => {
    render(<DeployApp />);

    fireEvent.click(screen.getByRole("link", { name: "Back" }));

    expect(screen.getByText("home")).toBeTruthy();
  });
});
