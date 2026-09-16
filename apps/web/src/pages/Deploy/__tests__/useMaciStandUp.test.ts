import { act, renderHook } from "@testing-library/react";
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
      currentMaci: null,
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
    readJobStateMock.mockResolvedValue({ job: runningJob, incompleteStandUp: false, currentMaci: null });
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
});
