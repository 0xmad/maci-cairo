import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OpsClient } from "../../../services/ops";
import { useOperatorSession } from "../../../stores/operatorSession";
import { MACI_LIST_PAGE_SIZE, useMaciInstances } from "../useMaciInstances";

const { readStoredJwtMock, listMacisMock } = vi.hoisted(() => ({
  readStoredJwtMock: vi.fn(),
  listMacisMock: vi.fn(),
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

describe("useMaciInstances", () => {
  beforeEach(() => {
    OpsClientMock.mockReset();
    readStoredJwtMock.mockReset();
    listMacisMock.mockReset();
    readStoredJwtMock.mockReturnValue("jwt");
    useOperatorSession.setState({ token: "jwt" });
    listMacisMock.mockResolvedValue({
      items: [
        { address: "0x064b48806902a367c8598f4f95c305e8c1a1acba5f082d294a43793113115691", network: "starknet_local" },
      ],
      total: 11,
      page: 1,
      pageSize: MACI_LIST_PAGE_SIZE,
    });
    OpsClientMock.mockImplementation(
      class {
        listMacis = listMacisMock;
      } as unknown as typeof OpsClient,
    );
  });

  it("loads the first page of MACI instances with the Operator JWT", async () => {
    const { result } = renderHook(() => useMaciInstances());

    await waitFor(() => {
      expect(result.current.items).toHaveLength(1);
    });

    expect(listMacisMock).toHaveBeenCalledWith("jwt", 1, 10);
    expect(result.current.signedIn).toBe(true);
    expect(result.current.pageCount).toBe(2);
    expect(result.current.items[0]?.network).toBe("starknet_local");
  });

  it("requests the next page", async () => {
    const { result } = renderHook(() => useMaciInstances());

    await waitFor(() => {
      expect(result.current.items).toHaveLength(1);
    });

    listMacisMock.mockResolvedValue({
      items: [{ address: "0x22", network: "starknet_local" }],
      total: 11,
      page: 2,
      pageSize: MACI_LIST_PAGE_SIZE,
    });

    act(() => {
      result.current.nextPage();
    });

    await waitFor(() => {
      expect(listMacisMock).toHaveBeenCalledWith("jwt", 2, 10);
    });

    act(() => {
      result.current.prevPage();
    });

    await waitFor(() => {
      expect(listMacisMock).toHaveBeenLastCalledWith("jwt", 1, 10);
    });
  });

  it("does not page below 1", async () => {
    const { result } = renderHook(() => useMaciInstances());

    await waitFor(() => {
      expect(result.current.items).toHaveLength(1);
    });

    act(() => {
      result.current.prevPage();
    });

    expect(result.current.page).toBe(1);
    expect(listMacisMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces a list error", async () => {
    listMacisMock.mockRejectedValue(new Error("forbidden"));

    const { result } = renderHook(() => useMaciInstances());

    await waitFor(() => {
      expect(result.current.error).toBe("forbidden");
    });
  });

  it("surfaces a non-Error list failure", async () => {
    listMacisMock.mockRejectedValue("down");

    const { result } = renderHook(() => useMaciInstances());

    await waitFor(() => {
      expect(result.current.error).toBe("MACI list failed");
    });
  });

  it("does not apply a list page after unmount", async () => {
    let resolveList: (page: {
      items: { address: string; network: "starknet_local" }[];
      total: number;
      page: number;
      pageSize: number;
    }) => void = (): void => undefined;

    listMacisMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveList = resolve;
        }),
    );

    const { result, unmount } = renderHook(() => useMaciInstances());

    unmount();

    await act(async () => {
      resolveList({
        items: [{ address: "0x7", network: "starknet_local" }],
        total: 1,
        page: 1,
        pageSize: MACI_LIST_PAGE_SIZE,
      });
      await Promise.resolve();
    });

    expect(result.current.items).toEqual([]);
  });

  it("does not record a list error after unmount", async () => {
    let rejectList: (error: Error) => void = (): void => undefined;

    listMacisMock.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectList = reject;
        }),
    );

    const { result, unmount } = renderHook(() => useMaciInstances());

    unmount();

    await act(async () => {
      rejectList(new Error("forbidden"));
      await Promise.resolve();
    });

    expect(result.current.error).toBeUndefined();
  });

  it("does not fetch when the Operator is signed out", () => {
    readStoredJwtMock.mockReturnValue(undefined);
    useOperatorSession.setState({ token: undefined });

    const { result } = renderHook(() => useMaciInstances());

    expect(result.current.signedIn).toBe(false);
    expect(result.current.items).toEqual([]);
    expect(listMacisMock).not.toHaveBeenCalled();
  });

  it("treats an empty list as zero pages", async () => {
    listMacisMock.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: MACI_LIST_PAGE_SIZE,
    });

    const { result } = renderHook(() => useMaciInstances());

    await waitFor(() => {
      expect(listMacisMock).toHaveBeenCalled();
    });

    expect(result.current.pageCount).toBe(0);

    act(() => {
      result.current.nextPage();
    });

    expect(result.current.page).toBe(1);
    expect(listMacisMock).toHaveBeenCalledTimes(1);
  });
});
