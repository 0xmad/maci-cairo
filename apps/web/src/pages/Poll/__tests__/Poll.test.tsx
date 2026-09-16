import { fireEvent, render, screen } from "@testing-library/react";
import { type JSX } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PollPage } from "..";
import { usePoll } from "../usePoll";

vi.mock("../usePoll", () => ({
  usePoll: vi.fn(),
}));

const usePollMock = vi.mocked(usePoll);

const POLL = {
  address: "0x00000000000000000000000000000000000000000000000000000000000000aa",
  pollId: "2",
  startDate: String(Date.UTC(2026, 8, 16, 10, 0, 0) / 1000),
  endDate: String(Date.UTC(2026, 8, 16, 22, 30, 0) / 1000),
  pollPublicKey: ["0", "1"] as [string, string],
  createdAtMs: Date.UTC(2026, 8, 16, 12, 0, 0),
  maci: "0x7",
};

const PollApp = (): JSX.Element => (
  <MemoryRouter initialEntries={["/poll/0xaa"]}>
    <Routes>
      <Route element={<PollPage />} path="/poll/:address" />

      <Route element={<p>home</p>} path="/" />

      <Route element={<p>maci-instance</p>} path="/maci/:address" />
    </Routes>
  </MemoryRouter>
);

describe("PollPage", () => {
  beforeEach(() => {
    usePollMock.mockReturnValue({
      maci: "0x7",
      pollAddress: "0xaa",
      signedIn: false,
    });
  });

  it("asks an unsigned-in visitor to sign in as Operator", () => {
    render(<PollApp />);

    expect(screen.getByRole("heading", { name: "Poll" })).toBeTruthy();
    expect(screen.getByText("Sign in as Operator to view this Poll.")).toBeTruthy();
  });

  it("shows recorded Poll fields and on-chain ballot count", () => {
    usePollMock.mockReturnValue({
      maci: "0x7",
      pollAddress: "0xaa",
      signedIn: true,
      poll: POLL,
      ballotCount: "4",
    });

    render(<PollApp />);

    expect(screen.getByText("Poll id")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("MACI")).toBeTruthy();
    expect(screen.getByText("0x7")).toBeTruthy();
    expect(screen.getByText("Start")).toBeTruthy();
    expect(screen.getByText("2026-09-16 10:00 UTC")).toBeTruthy();
    expect(screen.getByText("End")).toBeTruthy();
    expect(screen.getByText("2026-09-16 22:30 UTC")).toBeTruthy();
    expect(screen.getByText("Poll public key")).toBeTruthy();
    expect(screen.getByText("macipk.01")).toBeTruthy();
    expect(screen.getByText("Created at")).toBeTruthy();
    expect(screen.getByText("2026-09-16 12:00 UTC")).toBeTruthy();
    expect(screen.getByText("Ballot count")).toBeTruthy();
    expect(screen.getByText("4")).toBeTruthy();
  });

  it("omits ballot count when contract data is missing", () => {
    usePollMock.mockReturnValue({
      maci: "0x7",
      pollAddress: "0xaa",
      signedIn: true,
      poll: POLL,
    });

    render(<PollApp />);

    expect(screen.getByText("Poll id")).toBeTruthy();
    expect(screen.queryByText("Ballot count")).toBeNull();
  });

  it("shows a load error", () => {
    usePollMock.mockReturnValue({
      maci: "0x7",
      pollAddress: "0xaa",
      signedIn: true,
      error: "poll not found",
    });

    render(<PollApp />);

    expect(screen.getByText("poll not found")).toBeTruthy();
  });

  it("returns Home when the Poll has no MACI", () => {
    usePollMock.mockReturnValue({
      pollAddress: "0xaa",
      signedIn: true,
    });

    render(<PollApp />);

    fireEvent.click(screen.getByRole("link", { name: "Back" }));

    expect(screen.getByText("home")).toBeTruthy();
  });

  it("returns to the MACI instance when Back is used", () => {
    render(<PollApp />);

    fireEvent.click(screen.getByRole("link", { name: "Back" }));

    expect(screen.getByText("maci-instance")).toBeTruthy();
  });
});
