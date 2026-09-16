import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OpsClient } from "../../../services/ops";
import { useOperatorSession } from "../../../stores/operatorSession";
import { usePollsStore } from "../../../stores/polls";
import { POLL_LIST_PAGE_SIZE, usePolls } from "../usePolls";

const { readStoredJwtMock, listPollsMock } = vi.hoisted(() => ({
  readStoredJwtMock: vi.fn(),
  listPollsMock: vi.fn(),
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
const originalLoad = usePollsStore.getState().load;

describe("usePolls", () => {
  beforeEach(() => {
    OpsClientMock.mockReset();
    readStoredJwtMock.mockReset();
    listPollsMock.mockReset();
    readStoredJwtMock.mockReturnValue("jwt");
    useOperatorSession.setState({ token: "jwt" });
    usePollsStore.setState({ load: originalLoad });
    usePollsStore.getState().reset();
    listPollsMock.mockResolvedValue({
      items: [
        {
          address: "0xaa",
          pollId: "2",
          startDate: "0",
          endDate: "1000",
          pollPublicKey: ["0", "1"],
          createdAtMs: 1_000_200,
        },
      ],
      total: 11,
      page: 1,
      pageSize: POLL_LIST_PAGE_SIZE,
    });
    OpsClientMock.mockImplementation(
      class {
        listPolls = listPollsMock;
      } as unknown as typeof OpsClient,
    );
  });

  it("loads the first page of Polls for the MACI", async () => {
    const { result } = renderHook(() => usePolls("0x7"));

    await waitFor(() => {
      expect(result.current.items).toHaveLength(1);
    });

    expect(listPollsMock).toHaveBeenCalledWith("jwt", "0x7", 1, 10);
    expect(result.current.pageCount).toBe(2);
  });

  it("does not fetch when the Operator is signed out", () => {
    readStoredJwtMock.mockReturnValue(undefined);
    useOperatorSession.setState({ token: undefined });

    const { result } = renderHook(() => usePolls("0x7"));

    expect(result.current.signedIn).toBe(false);
    expect(listPollsMock).not.toHaveBeenCalled();
  });

  it("surfaces a list error", async () => {
    listPollsMock.mockRejectedValue(new Error("forbidden"));

    const { result } = renderHook(() => usePolls("0x7"));

    await waitFor(() => {
      expect(result.current.error).toBe("forbidden");
    });
  });

  it("surfaces a non-Error list failure", async () => {
    listPollsMock.mockRejectedValue("down");

    const { result } = renderHook(() => usePolls("0x7"));

    await waitFor(() => {
      expect(result.current.error).toBe("Poll list failed");
    });
  });

  it("does not fetch without a MACI address", () => {
    const { result } = renderHook(() => usePolls(""));

    expect(listPollsMock).not.toHaveBeenCalled();
    expect(result.current.items).toEqual([]);
  });

  it("treats an empty list as zero pages", async () => {
    listPollsMock.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: POLL_LIST_PAGE_SIZE,
    });

    const { result } = renderHook(() => usePolls("0x7"));

    await waitFor(() => {
      expect(listPollsMock).toHaveBeenCalled();
    });

    expect(result.current.pageCount).toBe(0);

    act(() => {
      result.current.nextPage();
    });

    expect(result.current.page).toBe(1);
    expect(listPollsMock).toHaveBeenCalledTimes(1);
  });

  it("requests the next page then previous", async () => {
    const { result } = renderHook(() => usePolls("0x7"));

    await waitFor(() => {
      expect(result.current.items).toHaveLength(1);
    });

    act(() => {
      result.current.nextPage();
    });

    await waitFor(() => {
      expect(listPollsMock).toHaveBeenCalledWith("jwt", "0x7", 2, 10);
    });

    act(() => {
      result.current.prevPage();
    });

    await waitFor(() => {
      expect(listPollsMock).toHaveBeenLastCalledWith("jwt", "0x7", 1, 10);
    });
  });

  it("keeps the list idle when load rejects", async () => {
    const load = vi.fn().mockRejectedValue(new Error("down"));

    usePollsStore.setState({ load });

    const { result } = renderHook(() => usePolls("0x7"));

    await waitFor(() => {
      expect(load).toHaveBeenCalledWith("jwt", "0x7", 1);
    });

    expect(result.current.items).toEqual([]);
    expect(result.current.error).toBeUndefined();
  });
});
