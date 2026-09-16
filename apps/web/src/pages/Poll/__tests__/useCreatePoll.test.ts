import { act, renderHook, waitFor } from "@testing-library/react";
import { useNavigate, useParams } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OpsClient } from "../../../services/ops";
import { useOperatorSession } from "../../../stores/operatorSession";
import { useStandUpJob } from "../../../stores/standUpJob";
import { useToasts } from "../../../stores/toast";
import { useCreatePoll } from "../useCreatePoll.js";

const CREATE_POLL_BODY = {
  startDate: 10,
  endDate: 20,
  pollPublicKey: ["3", "4"],
};

const { readStoredJwtMock, startCreatePollMock, readJobStateMock, subscribeJobEventsMock, toast, navigate } =
  vi.hoisted(() => ({
    readStoredJwtMock: vi.fn(),
    startCreatePollMock: vi.fn(),
    readJobStateMock: vi.fn(),
    subscribeJobEventsMock: vi.fn(),
    toast: { success: vi.fn(), error: vi.fn(), dismiss: vi.fn() },
    navigate: vi.fn(),
  }));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("react-router-dom");

  return {
    ...actual,
    useParams: vi.fn(),
    useNavigate: vi.fn(),
  };
});

vi.mock("sonner", () => ({
  toast,
  Toaster: (): null => null,
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
  OpsClient: vi.fn(),
}));

const OpsClientMock = vi.mocked(OpsClient);
const useParamsMock = vi.mocked(useParams);
const useNavigateMock = vi.mocked(useNavigate);

describe("useCreatePoll", () => {
  beforeEach(() => {
    OpsClientMock.mockReset();
    readStoredJwtMock.mockReset();
    startCreatePollMock.mockReset();
    readJobStateMock.mockReset();
    subscribeJobEventsMock.mockReset();
    toast.success.mockReset();
    toast.error.mockReset();
    toast.dismiss.mockReset();
    navigate.mockReset();
    useToasts.getState().reset();
    useParamsMock.mockReturnValue({ address: "0x7" });
    useNavigateMock.mockReturnValue(navigate);
    readStoredJwtMock.mockReturnValue("jwt");
    useOperatorSession.setState({ token: "jwt" });
    useStandUpJob.setState({
      starting: false,
      discarding: false,
      error: undefined,
      job: undefined,
      incompleteStandUp: false,
      currentMaci: null,
      steps: [],
      streamId: 0,
    });
    startCreatePollMock.mockResolvedValue("job-2");
    const runningJob = {
      id: "job-2",
      kind: "create_poll" as const,
      status: "running" as const,
      steps: [] as [],
    };
    readJobStateMock.mockResolvedValue({ job: runningJob, incompleteStandUp: false, currentMaci: "0x7" });
    subscribeJobEventsMock.mockResolvedValue(undefined);
    OpsClientMock.mockImplementation(
      class {
        startCreatePoll = startCreatePollMock;

        readJobState = readJobStateMock;

        subscribeJobEvents = subscribeJobEventsMock;
      } as unknown as typeof OpsClient,
    );
  });

  it("starts Create Poll with the stored JWT and MACI address", async () => {
    const { result } = renderHook(() => useCreatePoll());

    await act(async () => {
      await result.current.startCreatePoll(CREATE_POLL_BODY);
    });

    expect(startCreatePollMock).toHaveBeenCalledWith("jwt", "0x7", CREATE_POLL_BODY);
    expect(result.current.running).toBe(true);
    expect(result.current.currentMaci).toBe("0x7");
  });

  it("surfaces busy from the ops application", async () => {
    startCreatePollMock.mockRejectedValue(new Error("busy"));

    const { result } = renderHook(() => useCreatePoll());

    await act(async () => {
      await result.current.startCreatePoll(CREATE_POLL_BODY);
    });

    expect(result.current.error).toBe("busy");
  });

  it("toasts a Create Poll error", () => {
    const { rerender } = renderHook(() => useCreatePoll());

    act(() => {
      useStandUpJob.setState({ error: "busy" });
    });
    rerender();

    expect(toast.error).toHaveBeenCalledWith("busy", {
      id: "maci-stand-up-error",
      duration: Number.POSITIVE_INFINITY,
      closeButton: true,
    });
  });

  it("returns to the MACI instance after a succeeded Create Poll", async () => {
    const { result } = renderHook(() => useCreatePoll());

    await act(async () => {
      await result.current.startCreatePoll(CREATE_POLL_BODY);
    });

    act(() => {
      useStandUpJob.setState({
        job: { id: "job-2", kind: "create_poll", status: "succeeded", steps: [] },
      });
    });

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith("/maci/0x7");
    });
  });

  it("does not return for a previous succeeded Create Poll", () => {
    useStandUpJob.setState({
      job: { id: "job-2", kind: "create_poll", status: "succeeded", steps: [] },
    });

    renderHook(() => useCreatePoll());

    expect(navigate).not.toHaveBeenCalled();
  });
});
