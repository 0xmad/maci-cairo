import { fireEvent, render, screen } from "@testing-library/react";
import { type JSX } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MaciPage } from "..";
import { useOpsJob } from "../../../hooks/useOpsJob";
import { useMaciInstance } from "../useMaciInstance";
import { usePolls } from "../usePolls";

vi.mock("../../../hooks/useOpsJob", () => ({
  useOpsJob: vi.fn(),
}));

vi.mock("../useMaciInstance", () => ({
  useMaciInstance: vi.fn(),
}));

vi.mock("../usePolls", () => ({
  POLL_LIST_PAGE_SIZE: 10,
  usePolls: vi.fn(),
}));

const useMaciInstanceMock = vi.mocked(useMaciInstance);
const usePollsMock = vi.mocked(usePolls);
const useOpsJobMock = vi.mocked(useOpsJob);

const nextPage = vi.fn();
const prevPage = vi.fn();

const INSTANCE = {
  leanImt: "0x1",
  checker: "0x2",
  enforcer: "0x3",
  assigner: "0x4",
  pollClassHash: "0x5",
  pollFactoryClassHash: "0x6",
  maci: "0x7",
  pollFactory: "0x8",
  coordinator: "0x9",
  deployer: "0xa",
  network: "starknet_local" as const,
  circuitProfile: "small",
  policy: "Free for all",
  voteBalanceAssigner: "Constant vote balance",
};

const POLL_ITEM = {
  address: "0x00000000000000000000000000000000000000000000000000000000000000aa",
  pollId: "2",
  startDate: String(Date.UTC(2026, 8, 16, 10, 0, 0) / 1000),
  endDate: String(Date.UTC(2026, 8, 16, 22, 30, 0) / 1000),
  pollPublicKey: ["0", "1"] as [string, string],
  createdAtMs: Date.UTC(2026, 8, 16, 12, 0, 0),
};

const idleJob = {
  signedIn: false,
  starting: false,
  discarding: false,
  running: false,
  incompleteStandUp: false,
  currentMaci: null,
  steps: [],
};

const emptyPolls = {
  signedIn: true,
  items: [] as (typeof POLL_ITEM)[],
  page: 1,
  pageCount: 0,
  nextPage,
  prevPage,
};

const MaciApp = (): JSX.Element => (
  <MemoryRouter initialEntries={["/maci/0x7"]}>
    <Routes>
      <Route element={<MaciPage />} path="/maci/:address" />

      <Route element={<p>create-poll</p>} path="/maci/:address/poll" />
    </Routes>
  </MemoryRouter>
);

describe("MaciPage", () => {
  beforeEach(() => {
    nextPage.mockReset();
    prevPage.mockReset();
    useMaciInstanceMock.mockReturnValue({
      address: "0x7",
      signedIn: false,
    });
    usePollsMock.mockReturnValue(emptyPolls);
    useOpsJobMock.mockReturnValue(idleJob);
  });

  it("asks an unsigned-in visitor to sign in as Operator", () => {
    render(<MaciApp />);

    expect(screen.getByRole("heading", { name: "MACI" })).toBeTruthy();
    expect(screen.getByText("Sign in as Operator to view this MACI.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Create Poll" })).toBeNull();
  });

  it("shows Operator-facing stand-up choices and related contracts without Checker or Enforcer", () => {
    useMaciInstanceMock.mockReturnValue({
      address: "0x7",
      signedIn: true,
      instance: INSTANCE,
    });

    render(<MaciApp />);

    expect(screen.getByText("LeanIMT")).toBeTruthy();
    expect(screen.getByText("0x1")).toBeTruthy();
    expect(screen.getByText("Circuit profile")).toBeTruthy();
    expect(screen.getByText("small")).toBeTruthy();
    expect(screen.getByText("Policy")).toBeTruthy();
    expect(screen.getByText("Free for all")).toBeTruthy();
    expect(screen.getByText("Vote balance assigner")).toBeTruthy();
    expect(screen.getByText("Constant vote balance")).toBeTruthy();
    expect(screen.getByText("Deployer")).toBeTruthy();
    expect(screen.getByText("0xa")).toBeTruthy();
    expect(screen.getByText("Starknet Local")).toBeTruthy();
    expect(screen.queryByText("Checker")).toBeNull();
    expect(screen.queryByText("Enforcer")).toBeNull();
    expect(screen.queryByText("0x2")).toBeNull();
    expect(screen.queryByText("0x3")).toBeNull();
    expect(screen.getByRole("button", { name: "Create Poll" })).toBeTruthy();
    expect(screen.getByText("No polls yet.")).toBeTruthy();
  });

  it("opens Create Poll for this MACI", () => {
    useMaciInstanceMock.mockReturnValue({
      address: "0x7",
      signedIn: true,
      instance: INSTANCE,
    });

    render(<MaciApp />);

    fireEvent.click(screen.getByRole("button", { name: "Create Poll" }));

    expect(screen.getByText("create-poll")).toBeTruthy();
  });

  it("hides Create Poll while a job is running", () => {
    useMaciInstanceMock.mockReturnValue({
      address: "0x7",
      signedIn: true,
      instance: INSTANCE,
    });
    useOpsJobMock.mockReturnValue({ ...idleJob, signedIn: true, running: true });

    render(<MaciApp />);

    expect(screen.queryByRole("button", { name: "Create Poll" })).toBeNull();
  });

  it("hides Create Poll while an incomplete stand-up exists", () => {
    useMaciInstanceMock.mockReturnValue({
      address: "0x7",
      signedIn: true,
      instance: INSTANCE,
    });
    useOpsJobMock.mockReturnValue({ ...idleJob, signedIn: true, incompleteStandUp: true });

    render(<MaciApp />);

    expect(screen.queryByRole("button", { name: "Create Poll" })).toBeNull();
  });

  it("lists recorded Polls", () => {
    useMaciInstanceMock.mockReturnValue({
      address: "0x7",
      signedIn: true,
      instance: INSTANCE,
    });
    usePollsMock.mockReturnValue({
      ...emptyPolls,
      items: [POLL_ITEM],
      pageCount: 1,
    });

    render(<MaciApp />);

    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.getByText("Address")).toBeTruthy();
    expect(screen.getByText("Poll id")).toBeTruthy();
    expect(screen.getByText("Start")).toBeTruthy();
    expect(screen.getByText("End")).toBeTruthy();
    expect(screen.queryByText("Poll public key")).toBeNull();
    expect(screen.getByText("0x0000…00aa")).toBeTruthy();
    expect(screen.queryByText(POLL_ITEM.address)).toBeNull();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("2026-09-16 10:00 UTC")).toBeTruthy();
    expect(screen.getByText("2026-09-16 22:30 UTC")).toBeTruthy();
    expect(screen.getByText("2026-09-16 12:00 UTC")).toBeTruthy();
  });

  it("labels a sepolia instance", () => {
    useMaciInstanceMock.mockReturnValue({
      address: "0x7",
      signedIn: true,
      instance: { ...INSTANCE, network: "sepolia" },
    });

    render(<MaciApp />);

    expect(screen.getByText("Sepolia")).toBeTruthy();
  });

  it("shows a load error", () => {
    useMaciInstanceMock.mockReturnValue({
      address: "0x7",
      signedIn: true,
      error: "maci not found",
    });

    render(<MaciApp />);

    expect(screen.getByText("maci not found")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Create Poll" })).toBeNull();
  });

  it("shows a Poll list error", () => {
    useMaciInstanceMock.mockReturnValue({
      address: "0x7",
      signedIn: true,
      instance: INSTANCE,
    });
    usePollsMock.mockReturnValue({
      ...emptyPolls,
      error: "Poll list failed",
    });

    render(<MaciApp />);

    expect(screen.getByText("Poll list failed")).toBeTruthy();
  });
});
