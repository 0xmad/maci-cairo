import { renderHook, waitFor } from "@testing-library/react";
import { useParams } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OpsClient } from "../../../services/ops";
import { useOperatorSession } from "../../../stores/operatorSession";
import { usePollStore } from "../../../stores/poll";
import { usePoll } from "../usePoll";

const POLL = {
  address: "0xaa",
  pollId: "2",
  startDate: "0",
  endDate: "1000",
  pollPublicKey: ["0", "1"] as [string, string],
  createdAtMs: 1_000_200,
  maci: "0x7",
};

const { readStoredJwtMock, readPollMock, readContractDataMock } = vi.hoisted(() => ({
  readStoredJwtMock: vi.fn(),
  readPollMock: vi.fn(),
  readContractDataMock: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("react-router-dom");

  return {
    ...actual,
    useParams: vi.fn(),
  };
});

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

vi.mock("../../../providers/Network", () => ({
  useNetwork: (): { network: "local" } => ({ network: "local" }),
}));

vi.mock("../../../services/ops", () => ({
  OpsClient: vi.fn(),
}));

vi.mock("../../../services/poll/pollStarknetContractData.js", () => ({
  pollStarknetContractData: { read: readContractDataMock },
}));

const useParamsMock = vi.mocked(useParams);
const OpsClientMock = vi.mocked(OpsClient);
const originalLoadPollData = usePollStore.getState().loadPollData;

describe("usePoll", () => {
  beforeEach(() => {
    OpsClientMock.mockReset();
    readStoredJwtMock.mockReset();
    readPollMock.mockReset();
    readContractDataMock.mockReset();
    readStoredJwtMock.mockReturnValue("jwt");
    useOperatorSession.setState({ token: "jwt" });
    usePollStore.setState({ loadPollData: originalLoadPollData });
    usePollStore.getState().reset();
    useParamsMock.mockReturnValue({ address: "0xaa" });
    readPollMock.mockResolvedValue(POLL);
    readContractDataMock.mockResolvedValue({ ballotCount: "4" });
    OpsClientMock.mockImplementation(
      class {
        readPoll = readPollMock;
      } as unknown as typeof OpsClient,
    );
  });

  it("loads the Poll and ballot_count for the URL", async () => {
    const { result } = renderHook(() => usePoll());

    await waitFor(() => {
      expect(result.current.poll).toEqual(POLL);
      expect(result.current.ballotCount).toBe("4");
    });

    expect(readPollMock).toHaveBeenCalledWith("jwt", "0xaa");
    expect(readContractDataMock).toHaveBeenCalledWith("local", "0xaa");
    expect(result.current.signedIn).toBe(true);
    expect(result.current.maci).toBe("0x7");
    expect(result.current.pollAddress).toBe("0xaa");
  });

  it("does not fetch when the Operator is signed out", () => {
    readStoredJwtMock.mockReturnValue(undefined);
    useOperatorSession.setState({ token: undefined });

    const { result } = renderHook(() => usePoll());

    expect(result.current.signedIn).toBe(false);
    expect(result.current.poll).toBeUndefined();
    expect(readPollMock).not.toHaveBeenCalled();
    expect(readContractDataMock).not.toHaveBeenCalled();
  });

  it("does not fetch without a Poll address", () => {
    useParamsMock.mockReturnValue({ address: "" });

    const { result } = renderHook(() => usePoll());

    expect(result.current.poll).toBeUndefined();
    expect(readPollMock).not.toHaveBeenCalled();
    expect(readContractDataMock).not.toHaveBeenCalled();
  });

  it("keeps the Poll idle when loadPollData rejects", async () => {
    const loadPollData = vi.fn().mockRejectedValue(new Error("down"));

    usePollStore.setState({ loadPollData });

    const { result } = renderHook(() => usePoll());

    await waitFor(() => {
      expect(loadPollData).toHaveBeenCalledWith("jwt", "0xaa", "local");
    });

    expect(result.current.poll).toBeUndefined();
    expect(result.current.error).toBeUndefined();
  });

  it("surfaces a missing Poll as an error", async () => {
    readPollMock.mockRejectedValue(new Error("poll not found"));

    const { result } = renderHook(() => usePoll());

    await waitFor(() => {
      expect(result.current.error).toBe("poll not found");
    });
  });
});
