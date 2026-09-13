import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DeployPage } from "..";
import { App } from "../../../App";
import { useToasts } from "../../../stores/toast";
import { useMaciInstances } from "../useMaciInstances";
import { useMaciStandUp } from "../useMaciStandUp";

const { toast } = vi.hoisted(() => ({
  toast: { success: vi.fn(), error: vi.fn(), dismiss: vi.fn() },
}));

vi.mock("sonner", () => ({
  toast,
  Toaster: (): null => null,
}));

vi.mock("../useMaciStandUp", () => ({
  useMaciStandUp: vi.fn(),
}));

vi.mock("../useMaciInstances", () => ({
  useMaciInstances: vi.fn(),
}));

const useMaciStandUpMock = vi.mocked(useMaciStandUp);
const useMaciInstancesMock = vi.mocked(useMaciInstances);

const startStandUp = vi.fn();
const nextPage = vi.fn();
const prevPage = vi.fn();

describe("Deploy page", () => {
  beforeEach(() => {
    useToasts.getState().reset();
    toast.success.mockReset();
    toast.error.mockReset();
    toast.dismiss.mockReset();
    startStandUp.mockReset();
    startStandUp.mockResolvedValue(undefined);
    nextPage.mockReset();
    prevPage.mockReset();
    useMaciStandUpMock.mockReturnValue({
      signedIn: false,
      starting: false,
      running: false,
      steps: [],
      startStandUp,
    });
    useMaciInstancesMock.mockReturnValue({
      signedIn: false,
      items: [],
      page: 1,
      pageCount: 0,
      nextPage,
      prevPage,
    });
  });

  it("renders the Deploy MACI heading and a Connect control", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "MACI stand-up" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Connect" })).toBeTruthy();
  });

  it("asks an unsigned-in visitor to sign in as Operator and does not offer in-wallet deploy", () => {
    render(
      <MemoryRouter>
        <DeployPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Sign in as Operator to start MACI stand-up.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Start MACI stand-up" })).toBeNull();
    expect(screen.queryByText(/declare and deploy the contract graph/iu)).toBeNull();
    expect(screen.getByText(/Your wallet is only used to sign in/u)).toBeTruthy();
    expect(screen.getByText("Sign in as Operator to list MACI instances.")).toBeTruthy();
  });

  it("starts MACI stand-up without showing a finished job log", async () => {
    startStandUp.mockRejectedValue(new Error("busy"));
    useMaciStandUpMock.mockReturnValue({
      signedIn: true,
      starting: false,
      running: false,
      job: { id: "job-1", kind: "standup", status: "succeeded", steps: [] },
      steps: [{ seq: 1, kind: "declare", name: "LeanIMT" }],
      startStandUp,
    });
    useMaciInstancesMock.mockReturnValue({
      signedIn: true,
      items: [],
      page: 1,
      pageCount: 0,
      nextPage,
      prevPage,
    });

    render(
      <MemoryRouter>
        <DeployPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Start MACI stand-up" }));
    await Promise.resolve();

    expect(startStandUp).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("declare LeanIMT")).toBeNull();
    expect(screen.queryByLabelText("MACI stand-up steps")).toBeNull();
    expect(screen.getByText("No MACI instances yet.")).toBeTruthy();
  });

  it("does not show a previous job status while stand-up is starting", () => {
    useMaciStandUpMock.mockReturnValue({
      signedIn: true,
      starting: true,
      running: false,
      job: { id: "job-1", kind: "standup", status: "succeeded", steps: [] },
      steps: [],
      startStandUp,
    });
    useMaciInstancesMock.mockReturnValue({
      signedIn: true,
      items: [],
      page: 1,
      pageCount: 0,
      nextPage,
      prevPage,
    });

    render(
      <MemoryRouter>
        <DeployPage />
      </MemoryRouter>,
    );

    expect(screen.queryByText(/Job succeeded/u)).toBeNull();
    expect(screen.queryByText("declare LeanIMT")).toBeNull();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.dismiss).not.toHaveBeenCalled();
  });

  it("shows only the current stand-up step while a job is running", () => {
    useMaciStandUpMock.mockReturnValue({
      signedIn: true,
      starting: false,
      running: true,
      job: { id: "job-1", kind: "standup", status: "running", steps: [] },
      steps: [
        { seq: 1, kind: "declare", name: "LeanIMT" },
        { seq: 2, kind: "deploy", name: "leanImt" },
      ],
      startStandUp,
    });
    useMaciInstancesMock.mockReturnValue({
      signedIn: true,
      items: [],
      page: 1,
      pageCount: 0,
      nextPage,
      prevPage,
    });

    render(
      <MemoryRouter>
        <DeployPage />
      </MemoryRouter>,
    );

    expect(screen.queryByText("declare LeanIMT")).toBeNull();
    expect(toast.success).toHaveBeenCalledWith("declare LeanIMT", {
      id: "maci-stand-up-step-1",
      duration: 4_000,
    });
    expect(toast.success).toHaveBeenCalledWith("deploy leanImt", {
      id: "maci-stand-up-step-2",
      duration: Number.POSITIVE_INFINITY,
    });
    expect(toast.error).not.toHaveBeenCalled();
    expect(screen.queryByText(/Job /u)).toBeNull();
  });

  it("lists truncated addresses and opens a row", () => {
    useMaciStandUpMock.mockReturnValue({
      signedIn: true,
      starting: false,
      running: false,
      steps: [],
      startStandUp,
    });
    useMaciInstancesMock.mockReturnValue({
      signedIn: true,
      items: [
        { address: "0x064b48806902a367c8598f4f95c305e8c1a1acba5f082d294a43793113115691", network: "starknet_local" },
      ],
      page: 1,
      pageCount: 2,
      nextPage,
      prevPage,
    });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<DeployPage />} path="/" />

          <Route element={<p>maci-detail</p>} path="/maci/:address" />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("0x064b…5691")).toBeTruthy();
    expect(screen.getByText("Starknet Local")).toBeTruthy();
    expect(screen.getByText("Page 1 of 2")).toBeTruthy();

    fireEvent.click(screen.getByText("0x064b…5691"));

    expect(screen.getByText("maci-detail")).toBeTruthy();
  });

  it("opens a row with Enter", () => {
    useMaciStandUpMock.mockReturnValue({
      signedIn: true,
      starting: false,
      running: false,
      steps: [],
      startStandUp,
    });
    useMaciInstancesMock.mockReturnValue({
      signedIn: true,
      items: [
        { address: "0x064b48806902a367c8598f4f95c305e8c1a1acba5f082d294a43793113115691", network: "starknet_local" },
      ],
      page: 1,
      pageCount: 2,
      nextPage,
      prevPage,
    });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<DeployPage />} path="/" />

          <Route element={<p>maci-detail</p>} path="/maci/:address" />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.keyDown(screen.getByText("0x064b…5691"), { key: "Enter" });

    expect(screen.getByText("maci-detail")).toBeTruthy();
  });

  it("does not open a row for a non-Enter key", () => {
    useMaciStandUpMock.mockReturnValue({
      signedIn: true,
      starting: false,
      running: false,
      steps: [],
      startStandUp,
    });
    useMaciInstancesMock.mockReturnValue({
      signedIn: true,
      items: [{ address: "0x064b48806902a367c8598f4f95c305e8c1a1acba5f082d294a43793113115691", network: "sepolia" }],
      page: 1,
      pageCount: 1,
      error: "MACI list failed",
      nextPage,
      prevPage,
    });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<DeployPage />} path="/" />

          <Route element={<p>maci-detail</p>} path="/maci/:address" />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Sepolia")).toBeTruthy();
    expect(screen.getByText("MACI list failed")).toBeTruthy();

    fireEvent.keyDown(screen.getByText("0x064b…5691"), { key: " " });

    expect(screen.queryByText("maci-detail")).toBeNull();
  });

  it("shows a stand-up error", () => {
    useMaciStandUpMock.mockReturnValue({
      signedIn: true,
      starting: false,
      running: false,
      error: "busy",
      steps: [],
      startStandUp,
    });
    useMaciInstancesMock.mockReturnValue({
      signedIn: true,
      items: [],
      page: 1,
      pageCount: 0,
      nextPage,
      prevPage,
    });

    render(
      <MemoryRouter>
        <DeployPage />
      </MemoryRouter>,
    );

    expect(toast.error).toHaveBeenCalledWith("busy", {
      id: "maci-stand-up-error",
      duration: Number.POSITIVE_INFINITY,
      closeButton: true,
    });
    expect(screen.queryByText("busy")).toBeNull();
  });
});
