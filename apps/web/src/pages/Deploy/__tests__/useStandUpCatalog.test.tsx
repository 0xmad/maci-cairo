import { renderHook, screen, waitFor } from "@testing-library/react";
import { type JSX, type ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useOperatorSession } from "../../../stores/operatorSession";
import { useStandUpCatalogStore } from "../../../stores/standUpCatalog";
import { useToasts } from "../../../stores/toast";
import { useMaciStandUp } from "../useMaciStandUp";
import { useStandUpCatalog } from "../useStandUpCatalog";

const CATALOG = {
  circuitProfiles: [{ id: "small", maxSignups: 32, maxVoteOptions: 5 }],
  policies: [{ id: "Free for all" }],
  assigners: [{ id: "Constant vote balance" }],
};

const { readStoredJwtMock, readStandUpCatalogMock, toast } = vi.hoisted(() => ({
  readStoredJwtMock: vi.fn(),
  readStandUpCatalogMock: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn(), dismiss: vi.fn() },
}));

vi.mock("../../../services/localStorage", () => ({
  storage: {
    readStoredJwt: readStoredJwtMock,
    storeJwt: vi.fn(),
    clearStoredJwt: vi.fn(),
  },
}));

vi.mock("../../../config/ops", () => ({
  opsBaseUrl: (): string => "http://ops.test",
}));

vi.mock("../../../services/ops", () => ({
  OpsClient: class {
    readStandUpCatalog = readStandUpCatalogMock;
  },
}));

vi.mock("sonner", () => ({
  toast,
  Toaster: (): null => null,
}));

vi.mock("../useMaciStandUp", () => ({
  useMaciStandUp: vi.fn(),
}));

const useMaciStandUpMock = vi.mocked(useMaciStandUp);

const originalLoad = useStandUpCatalogStore.getState().load;
const originalReset = useStandUpCatalogStore.getState().reset;
const startStandUp = vi.fn();

const wrapper = ({ children }: { children: ReactNode }): JSX.Element => (
  <MemoryRouter initialEntries={["/deploy"]}>
    <Routes>
      <Route element={children} path="/deploy" />

      <Route element={<p>home</p>} path="/" />
    </Routes>
  </MemoryRouter>
);

const idleStandUp = {
  signedIn: true,
  starting: false,
  discarding: false,
  running: false,
  incompleteStandUp: false,
  currentMaci: null,
  steps: [] as [],
  startStandUp,
  discardStandUp: vi.fn(),
};

describe("useStandUpCatalog", () => {
  beforeEach(() => {
    readStoredJwtMock.mockReset();
    readStandUpCatalogMock.mockReset();
    startStandUp.mockReset();
    toast.success.mockReset();
    toast.error.mockReset();
    toast.dismiss.mockReset();
    useToasts.getState().reset();
    readStoredJwtMock.mockReturnValue("jwt");
    useOperatorSession.setState({ token: "jwt" });
    useStandUpCatalogStore.setState({
      catalog: undefined,
      error: undefined,
      generation: 0,
      load: originalLoad,
      reset: originalReset,
    });
    readStandUpCatalogMock.mockResolvedValue(CATALOG);
    useMaciStandUpMock.mockReturnValue(idleStandUp);
  });

  it("loads the stand-up catalog with the Operator JWT", async () => {
    const { result } = renderHook(() => useStandUpCatalog(), { wrapper });

    await waitFor(() => {
      expect(result.current.catalog).toEqual(CATALOG);
    });

    expect(readStandUpCatalogMock).toHaveBeenCalledWith("jwt");
  });

  it("does not load a catalog without a JWT", () => {
    useOperatorSession.setState({ token: undefined });

    const { result } = renderHook(() => useStandUpCatalog(), { wrapper });

    expect(result.current.catalog).toBeUndefined();
    expect(readStandUpCatalogMock).not.toHaveBeenCalled();
  });

  it("surfaces a catalog error", async () => {
    readStandUpCatalogMock.mockRejectedValue(new Error("catalog failed"));

    const { result } = renderHook(() => useStandUpCatalog(), { wrapper });

    await waitFor(() => {
      expect(result.current.error).toBe("catalog failed");
    });

    expect(result.current.catalog).toBeUndefined();
  });

  it("keeps the catalog idle when load rejects", async () => {
    const load = vi.fn().mockRejectedValue(new Error("down"));

    useStandUpCatalogStore.setState({ load });

    const { result } = renderHook(() => useStandUpCatalog(), { wrapper });

    await waitFor(() => {
      expect(load).toHaveBeenCalledWith("jwt");
    });

    expect(result.current.catalog).toBeUndefined();
    expect(result.current.error).toBeUndefined();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("returns to Home when stand-up succeeds", async () => {
    const { rerender } = renderHook(() => useStandUpCatalog(), { wrapper });

    useMaciStandUpMock.mockReturnValue({
      ...idleStandUp,
      running: true,
      job: { id: "job-1", kind: "standup", status: "running", steps: [] },
    });
    rerender();

    expect(screen.queryByText("home")).toBeNull();

    useMaciStandUpMock.mockReturnValue({
      ...idleStandUp,
      job: { id: "job-1", kind: "standup", status: "succeeded", steps: [] },
    });
    rerender();

    await waitFor(() => {
      expect(screen.getByText("home")).toBeTruthy();
    });
  });

  it("stays on Deploy when stand-up fails", () => {
    const { rerender } = renderHook(() => useStandUpCatalog(), { wrapper });

    useMaciStandUpMock.mockReturnValue({
      ...idleStandUp,
      running: true,
      job: { id: "job-1", kind: "standup", status: "running", steps: [] },
    });
    rerender();

    useMaciStandUpMock.mockReturnValue({
      ...idleStandUp,
      job: { id: "job-1", kind: "standup", status: "failed", error: "set_target failed", steps: [] },
    });
    rerender();

    expect(screen.queryByText("home")).toBeNull();
  });

  it("does not return to Home for a previous succeeded job", () => {
    useMaciStandUpMock.mockReturnValue({
      ...idleStandUp,
      job: { id: "job-1", kind: "standup", status: "succeeded", steps: [] },
    });

    renderHook(() => useStandUpCatalog(), { wrapper });

    expect(screen.queryByText("home")).toBeNull();
  });

  it("toasts a stand-up error", () => {
    useMaciStandUpMock.mockReturnValue({
      ...idleStandUp,
      error: "busy",
    });

    renderHook(() => useStandUpCatalog(), { wrapper });

    expect(toast.error).toHaveBeenCalledWith("busy", {
      id: "maci-stand-up-error",
      duration: Number.POSITIVE_INFINITY,
      closeButton: true,
    });
  });
});
