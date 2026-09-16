import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OpsClient } from "../../services/ops";
import { useOperatorSession } from "../../stores/operatorSession";
import { useStandUpJob } from "../../stores/standUpJob";
import { useOpsJob } from "../useOpsJob";

const { readStoredJwtMock, readJobStateMock, subscribeJobEventsMock } = vi.hoisted(() => ({
  readStoredJwtMock: vi.fn(),
  readJobStateMock: vi.fn(),
  subscribeJobEventsMock: vi.fn(),
}));

vi.mock("../../services/localStorage", () => ({
  storage: {
    readStoredJwt: readStoredJwtMock,
    storeJwt: vi.fn(),
    clearStoredJwt: vi.fn(),
  },
}));

vi.mock("../../config/ops", () => ({
  opsBaseUrl: (): string => "http://ops.test",
}));

vi.mock("../../services/ops", () => ({
  OpsClient: vi.fn(),
}));

const OpsClientMock = vi.mocked(OpsClient);
const originalWatch = useStandUpJob.getState().watch;

describe("useOpsJob", () => {
  beforeEach(() => {
    OpsClientMock.mockReset();
    readStoredJwtMock.mockReset();
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
      currentMaci: null,
      steps: [],
      streamId: 0,
      watch: originalWatch,
    });
    const runningJob = {
      id: "job-1",
      kind: "standup" as const,
      status: "running" as const,
      steps: [] as [],
    };
    readJobStateMock.mockResolvedValue({ job: runningJob, incompleteStandUp: false, currentMaci: "0x7" });
    subscribeJobEventsMock.mockResolvedValue(undefined);
    OpsClientMock.mockImplementation(
      class {
        readJobState = readJobStateMock;

        subscribeJobEvents = subscribeJobEventsMock;
      } as unknown as typeof OpsClient,
    );
  });

  it("is not signed in without a JWT", () => {
    useOperatorSession.setState({ token: undefined });

    const { result } = renderHook(() => useOpsJob());

    expect(result.current.signedIn).toBe(false);
    expect(result.current.running).toBe(false);
  });

  it("does not watch the job stream without a JWT", () => {
    useOperatorSession.setState({ token: undefined });

    renderHook(() => useOpsJob());

    expect(readJobStateMock).not.toHaveBeenCalled();
    expect(subscribeJobEventsMock).not.toHaveBeenCalled();
  });

  it("becomes signed in when a JWT is stored after mount", () => {
    useOperatorSession.setState({ token: undefined });

    const { result } = renderHook(() => useOpsJob());

    expect(result.current.signedIn).toBe(false);

    act(() => {
      useOperatorSession.getState().setToken("jwt");
    });

    expect(result.current.signedIn).toBe(true);
  });

  it("hydrates current MACI and a running job from the snapshot", async () => {
    const { result } = renderHook(() => useOpsJob());

    await waitFor(() => {
      expect(result.current.currentMaci).toBe("0x7");
    });

    expect(result.current.running).toBe(true);
    expect(result.current.incompleteStandUp).toBe(false);
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
      currentMaci: null,
    });

    const { result } = renderHook(() => useOpsJob());

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
      currentMaci: null,
    });

    const { result } = renderHook(() => useOpsJob());

    await waitFor(() => {
      expect(result.current.steps).toEqual([{ seq: 1, kind: "declare", name: "LeanIMT" }]);
    });

    expect(result.current.running).toBe(true);
  });

  it("ignores a failed job snapshot read", async () => {
    readJobStateMock.mockRejectedValue(new Error("job failed"));

    const { result } = renderHook(() => useOpsJob());

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

    const { result } = renderHook(() => useOpsJob());

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

    const { result, unmount } = renderHook(() => useOpsJob());

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

    const { result } = renderHook(() => useOpsJob());

    await waitFor(() => {
      expect(result.current.error).toBe("sse closed");
    });
  });

  it("ignores an aborted subscribe", async () => {
    const abortError = Object.assign(new Error("aborted"), { name: "AbortError" });

    subscribeJobEventsMock.mockRejectedValue(abortError);

    const { result } = renderHook(() => useOpsJob());

    await waitFor(() => {
      expect(subscribeJobEventsMock).toHaveBeenCalled();
    });

    expect(result.current.error).toBeUndefined();
  });

  it("does not apply a job snapshot after unmount", async () => {
    let resolveJob: (state: {
      job: { id: string; kind: "standup"; status: "running"; steps: [] };
      incompleteStandUp: boolean;
      currentMaci: string | null;
    }) => void = (): void => undefined;

    readJobStateMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveJob = resolve;
        }),
    );

    const { result, unmount } = renderHook(() => useOpsJob());

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
        currentMaci: null,
      });
      await Promise.resolve();
    });

    expect(result.current.job).toBeUndefined();
  });

  it("keeps the job idle when watch rejects", async () => {
    const watch = vi.fn().mockRejectedValue(new Error("down"));

    useStandUpJob.setState({ watch });

    const { result } = renderHook(() => useOpsJob());

    await waitFor(() => {
      expect(watch).toHaveBeenCalledWith("jwt", expect.any(AbortSignal));
    });

    expect(result.current.job).toBeUndefined();
    expect(result.current.error).toBeUndefined();
  });
});
