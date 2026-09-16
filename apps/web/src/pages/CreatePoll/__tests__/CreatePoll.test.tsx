import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type JSX } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CreatePollPage } from "..";
import { useCreatePoll } from "../useCreatePoll";

vi.mock("../useCreatePoll", () => ({
  useCreatePoll: vi.fn(),
}));

const useCreatePollMock = vi.mocked(useCreatePoll);

const startCreatePoll = vi.fn();

const idleJob = {
  signedIn: false,
  starting: false,
  discarding: false,
  running: false,
  incompleteStandUp: false,
  currentMaci: null,
  steps: [],
  recordedMaci: false,
  startCreatePoll,
};

const PollApp = (): JSX.Element => (
  <MemoryRouter initialEntries={["/maci/0x7/poll"]}>
    <Routes>
      <Route element={<CreatePollPage />} path="/maci/:address/poll" />

      <Route element={<p>maci-instance</p>} path="/maci/:address" />
    </Routes>
  </MemoryRouter>
);

describe("CreatePollPage", () => {
  beforeEach(() => {
    startCreatePoll.mockReset();
    startCreatePoll.mockResolvedValue(undefined);
    useCreatePollMock.mockReturnValue(idleJob);
  });

  it("asks an unsigned-in visitor to sign in as Operator", () => {
    render(<PollApp />);

    expect(screen.getByText("Sign in as Operator to create a Poll.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Create Poll" })).toBeNull();
    expect(screen.getByText(/Create a Poll on this MACI from this console/u)).toBeTruthy();
  });

  it("offers Create Poll on this MACI", () => {
    useCreatePollMock.mockReturnValue({ ...idleJob, signedIn: true, recordedMaci: true });

    render(<PollApp />);

    expect(screen.getByRole("button", { name: "Create Poll" })).toBeTruthy();
  });

  it("hides Create Poll while an incomplete stand-up exists", () => {
    useCreatePollMock.mockReturnValue({
      ...idleJob,
      signedIn: true,
      incompleteStandUp: true,
    });

    render(<PollApp />);

    expect(screen.queryByRole("button", { name: "Create Poll" })).toBeNull();
    expect(screen.getByText("Create Poll is unavailable while an incomplete stand-up exists.")).toBeTruthy();
  });

  it("hides Create Poll when this MACI is not recorded", () => {
    useCreatePollMock.mockReturnValue({
      ...idleJob,
      signedIn: true,
      recordedMaci: false,
    });

    render(<PollApp />);

    expect(screen.queryByRole("button", { name: "Create Poll" })).toBeNull();
    expect(screen.getByText("Create Poll needs a recorded MACI.")).toBeTruthy();
  });

  it("hides Create Poll while a job is running", () => {
    useCreatePollMock.mockReturnValue({
      ...idleJob,
      signedIn: true,
      running: true,
      steps: [{ seq: 1, kind: "call", name: "next_poll_id" }],
    });

    render(<PollApp />);

    expect(screen.queryByRole("button", { name: "Create Poll" })).toBeNull();
    expect(screen.getByText("Create Poll is unavailable while a job is running.")).toBeTruthy();
  });

  it("shows a job error", () => {
    useCreatePollMock.mockReturnValue({
      ...idleJob,
      signedIn: true,
      error: "busy",
    });

    render(<PollApp />);

    expect(screen.getByText("busy")).toBeTruthy();
  });

  it("starts Create Poll and stays on the page while the job runs", async () => {
    useCreatePollMock.mockReturnValue({ ...idleJob, signedIn: true, recordedMaci: true });

    render(<PollApp />);

    fireEvent.click(screen.getByRole("button", { name: "Create Poll" }));

    await waitFor(() => {
      expect(startCreatePoll).toHaveBeenCalled();
    });
    expect(screen.queryByText("maci-instance")).toBeNull();
    expect(screen.getByRole("button", { name: "Create Poll" })).toBeTruthy();
  });

  it("returns to the MACI instance when Back is used", () => {
    render(<PollApp />);

    fireEvent.click(screen.getByRole("link", { name: "Back" }));

    expect(screen.getByText("maci-instance")).toBeTruthy();
  });

  it("returns Home when Create Poll has no MACI address", () => {
    render(
      <MemoryRouter initialEntries={["/poll"]}>
        <Routes>
          <Route element={<CreatePollPage />} path="/poll" />

          <Route element={<p>home</p>} path="/" />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("link", { name: "Back" }));

    expect(screen.getByText("home")).toBeTruthy();
  });
});
