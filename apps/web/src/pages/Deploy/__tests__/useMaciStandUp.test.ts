import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OpsClient } from "../../../services/ops";
import { SMALL_STAND_UP_BODY } from "../../../services/ops/schema";
import { useOperatorSession } from "../../../stores/operatorSession";
import { useStandUpJob } from "../../../stores/standUpJob";
import { useMaciStandUp } from "../useMaciStandUp";

const {
  readStoredJwtMock,
  storeJwtMock,
  clearStoredJwtMock,
  startStandUpMock,
  discardStandUpMock,
  readJobStateMock,
  subscribeJobEventsMock,
} = vi.hoisted(() => ({
  readStoredJwtMock: vi.fn(),
  storeJwtMock: vi.fn(),
  clearStoredJwtMock: vi.fn(),
  startStandUpMock: vi.fn(),
  discardStandUpMock: vi.fn(),
  readJobStateMock: vi.fn(),
  subscribeJobEventsMock: vi.fn(),
}));

vi.mock("../../../services/localStorage", () => ({
  storage: {
    readStoredJwt: readStoredJwtMock,
    storeJwt: storeJwtMock,
    clearStoredJwt: clearStoredJwtMock,
  },
}));

vi.mock("../../../config/ops", () => ({
  opsBaseUrl: (): string => "http://ops.test",
}));

vi.mock("../../../services/ops", () => ({
  OpsClient: vi.fn(),
}));

const OpsClientMock = vi.mocked(OpsClient);

describe("useMaciStandUp", () => {
  beforeEach(() => {
    OpsClientMock.mockReset();
    readStoredJwtMock.mockReset();
    storeJwtMock.mockReset();
    clearStoredJwtMock.mockReset();
    startStandUpMock.mockReset();
    discardStandUpMock.mockReset();
    readJobStateMock.mockReset();
    subscribeJobEventsMock.mockReset();
    readStoredJwtMock.mockReturnValue("jwt");
    useOperatorSession.setState({ token: "jwt" });
    useStandUpJob.setState({
      starting: false,
      discarding: false,
      error: undefined,
      job: undefined,
      incompleteStandUp: false,
      steps: [],
      streamId: 0,
    });
    startStandUpMock.mockResolvedValue("job-1");
    discardStandUpMock.mockResolvedValue(undefined);
    const runningJob = {
      id: "job-1",
      kind: "standup" as const,
      status: "running" as const,
      steps: [] as [],
    };
    readJobStateMock.mockResolvedValue({ job: runningJob, incompleteStandUp: false });
    subscribeJobEventsMock.mockResolvedValue(undefined);
    OpsClientMock.mockImplementation(
      class {
        startStandUp = startStandUpMock;

        discardStandUp = discardStandUpMock;

        readJobState = readJobStateMock;

        subscribeJobEvents = subscribeJobEventsMock;
      } as unknown as typeof OpsClient,
    );
  });

  it("starts stand-up with the stored JWT and does not send an RPC URL", async () => {
    const { result } = renderHook(() => useMaciStandUp());

    await act(async () => {
      await result.current.startStandUp(SMALL_STAND_UP_BODY);
    });

    expect(startStandUpMock).toHaveBeenCalledWith("jwt", SMALL_STAND_UP_BODY);
    expect(result.current.running).toBe(true);
  });

  it("discards an incomplete stand-up with the stored JWT", async () => {
    const { result } = renderHook(() => useMaciStandUp());

    await act(async () => {
      await result.current.discardStandUp();
    });

    expect(discardStandUpMock).toHaveBeenCalledWith("jwt");
  });

  it("surfaces busy from the ops application", async () => {
    startStandUpMock.mockRejectedValue(new Error("busy"));

    const { result } = renderHook(() => useMaciStandUp());

    await act(async () => {
      await result.current.startStandUp(SMALL_STAND_UP_BODY);
    });

    expect(result.current.error).toBe("busy");
  });

  it("is not signed in without a JWT", () => {
    useOperatorSession.setState({ token: undefined });

    const { result } = renderHook(() => useMaciStandUp());

    expect(result.current.signedIn).toBe(false);
    expect(result.current.running).toBe(false);
  });

  it("becomes signed in when a JWT is stored after mount", () => {
    useOperatorSession.setState({ token: undefined });

    const { result } = renderHook(() => useMaciStandUp());

    expect(result.current.signedIn).toBe(false);

    act(() => {
      useOperatorSession.getState().setToken("jwt");
    });

    expect(result.current.signedIn).toBe(true);
  });

  it("does not keep steps from a finished job", async () => {
    readJobStateMock.mockResolvedValue({
      job: {
        id: "job-1",
        kind: "standup",
        status: "succeeded",
        steps: [{ seq: 1, kind: "declare", name: "LeanIMT" }],
      },
      incompleteStandUp: false,
    });

    const { result } = renderHook(() => useMaciStandUp());

    await waitFor(() => {
      expect(readJobStateMock).toHaveBeenCalled();
    });

    expect(result.current.running).toBe(false);
    expect(result.current.steps).toEqual([]);
  });

  it("shows steps already recorded for a running job", async () => {
    readJobStateMock.mockResolvedValue({
      job: {
        id: "job-1",
        kind: "standup",
        status: "running",
        steps: [{ seq: 1, kind: "declare", name: "LeanIMT" }],
      },
      incompleteStandUp: false,
    });

    const { result } = renderHook(() => useMaciStandUp());

    await waitFor(() => {
      expect(result.current.steps).toEqual([{ seq: 1, kind: "declare", name: "LeanIMT" }]);
    });

    expect(result.current.running).toBe(true);
  });

  it("ignores a failed job snapshot read", async () => {
    readJobStateMock.mockRejectedValue(new Error("job failed"));

    const { result } = renderHook(() => useMaciStandUp());

    await waitFor(() => {
      expect(readJobStateMock).toHaveBeenCalled();
    });

    expect(result.current.job).toBeUndefined();
    expect(result.current.error).toBeUndefined();
  });

  it("applies a live job event", async () => {
    let onEvent: ((event: { type: "step"; step: { seq: number; kind: string; name: string } }) => void) | undefined;

    subscribeJobEventsMock.mockImplementation(
      (
        _token: string,
        listener: (event: { type: "step"; step: { seq: number; kind: string; name: string } }) => void,
      ) => {
        onEvent = listener;

        return new Promise(() => {
          /* keep the job event stream open */
        });
      },
    );

    const { result } = renderHook(() => useMaciStandUp());

    await waitFor(() => {
      expect(subscribeJobEventsMock).toHaveBeenCalled();
    });

    act(() => {
      onEvent?.({ type: "step", step: { seq: 1, kind: "declare", name: "LeanIMT" } });
    });

    expect(result.current.steps).toEqual([{ seq: 1, kind: "declare", name: "LeanIMT" }]);
  });

  it("does not apply a job event after unmount", async () => {
    let onEvent: ((event: { type: "step"; step: { seq: number; kind: string; name: string } }) => void) | undefined;

    subscribeJobEventsMock.mockImplementation(
      (
        _token: string,
        listener: (event: { type: "step"; step: { seq: number; kind: string; name: string } }) => void,
      ) => {
        onEvent = listener;

        return new Promise(() => {
          /* keep the job event stream open */
        });
      },
    );

    const { result, unmount } = renderHook(() => useMaciStandUp());

    await waitFor(() => {
      expect(subscribeJobEventsMock).toHaveBeenCalled();
    });

    unmount();

    act(() => {
      onEvent?.({ type: "step", step: { seq: 1, kind: "declare", name: "LeanIMT" } });
    });

    expect(result.current.steps).toEqual([]);
  });

  it("records a subscribe failure", async () => {
    subscribeJobEventsMock.mockRejectedValue(new Error("sse closed"));

    const { result } = renderHook(() => useMaciStandUp());

    await waitFor(() => {
      expect(result.current.error).toBe("sse closed");
    });
  });

  it("ignores an aborted subscribe", async () => {
    const abortError = Object.assign(new Error("aborted"), { name: "AbortError" });

    subscribeJobEventsMock.mockRejectedValue(abortError);

    const { result } = renderHook(() => useMaciStandUp());

    await waitFor(() => {
      expect(subscribeJobEventsMock).toHaveBeenCalled();
    });

    expect(result.current.error).toBeUndefined();
  });

  it("does not apply a job snapshot after unmount", async () => {
    let resolveJob: (state: {
      job: { id: string; kind: "standup"; status: "running"; steps: [] };
      incompleteStandUp: boolean;
    }) => void = (): void => undefined;

    readJobStateMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveJob = resolve;
        }),
    );

    const { result, unmount } = renderHook(() => useMaciStandUp());

    unmount();

    await act(async () => {
      resolveJob({
        job: {
          id: "job-1",
          kind: "standup",
          status: "running",
          steps: [],
        },
        incompleteStandUp: false,
      });
      await Promise.resolve();
    });

    expect(result.current.job).toBeUndefined();
  });
});
