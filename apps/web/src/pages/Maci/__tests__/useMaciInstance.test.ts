import { act, renderHook, waitFor } from "@testing-library/react";
import { useParams } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OpsClient } from "../../../services/ops";
import { useOperatorSession } from "../../../stores/operatorSession";
import { useMaciInstance } from "../useMaciInstance";

const INSTANCE = {
  leanImt: "0x1",
  checker: "0x2",
  enforcer: "0x3",
  assigner: "0x4",
  pollClassHash: "0x5",
  pollFactoryClassHash: "0x6",
  maci: "0x7",
  pollFactory: "0x8",
  coordinator: "0x9",
  deployer: "0xa",
  network: "starknet_local" as const,
};

const { readStoredJwtMock, readMaciMock } = vi.hoisted(() => ({
  readStoredJwtMock: vi.fn(),
  readMaciMock: vi.fn(),
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

vi.mock("../../../services/ops", () => ({
  OpsClient: vi.fn(),
}));

const useParamsMock = vi.mocked(useParams);
const OpsClientMock = vi.mocked(OpsClient);

describe("useMaciInstance", () => {
  beforeEach(() => {
    OpsClientMock.mockReset();
    readStoredJwtMock.mockReset();
    readMaciMock.mockReset();
    readStoredJwtMock.mockReturnValue("jwt");
    useOperatorSession.setState({ token: "jwt" });
    useParamsMock.mockReturnValue({ address: "0x7" });
    readMaciMock.mockResolvedValue(INSTANCE);
    OpsClientMock.mockImplementation(
      class {
        readMaci = readMaciMock;
      } as unknown as typeof OpsClient,
    );
  });

  it("loads the MACI instance for the URL address", async () => {
    const { result } = renderHook(() => useMaciInstance());

    await waitFor(() => {
      expect(result.current.instance).toEqual(INSTANCE);
    });

    expect(readMaciMock).toHaveBeenCalledWith("jwt", "0x7");
    expect(result.current.signedIn).toBe(true);
    expect(result.current.address).toBe("0x7");
    expect(result.current.error).toBeUndefined();
  });

  it("does not fetch when the Operator is signed out", () => {
    readStoredJwtMock.mockReturnValue(undefined);
    useOperatorSession.setState({ token: undefined });

    const { result } = renderHook(() => useMaciInstance());

    expect(result.current.signedIn).toBe(false);
    expect(result.current.instance).toBeUndefined();
    expect(readMaciMock).not.toHaveBeenCalled();
  });

  it("surfaces a missing instance as an error", async () => {
    readMaciMock.mockRejectedValue(new Error("maci not found"));

    const { result } = renderHook(() => useMaciInstance());

    await waitFor(() => {
      expect(result.current.error).toBe("maci not found");
    });

    expect(result.current.instance).toBeUndefined();
  });

  it("surfaces a non-Error instance failure", async () => {
    readMaciMock.mockRejectedValue("down");

    const { result } = renderHook(() => useMaciInstance());

    await waitFor(() => {
      expect(result.current.error).toBe("MACI instance failed");
    });
  });

  it("does not apply a MACI instance after unmount", async () => {
    let resolveMaci: (instance: typeof INSTANCE) => void = (): void => undefined;

    readMaciMock.mockImplementation(
      (): Promise<typeof INSTANCE> =>
        new Promise((resolve) => {
          resolveMaci = resolve;
        }),
    );

    const { result, unmount } = renderHook(() => useMaciInstance());

    unmount();

    await act(async () => {
      resolveMaci(INSTANCE);
      await Promise.resolve();
    });

    expect(result.current.instance).toBeUndefined();
  });

  it("does not record a MACI instance error after unmount", async () => {
    let rejectMaci: (error: Error) => void = (): void => undefined;

    readMaciMock.mockImplementation(
      (): Promise<typeof INSTANCE> =>
        new Promise((_resolve, reject) => {
          rejectMaci = reject;
        }),
    );

    const { result, unmount } = renderHook(() => useMaciInstance());

    unmount();

    await act(async () => {
      rejectMaci(new Error("maci not found"));
      await Promise.resolve();
    });

    expect(result.current.error).toBeUndefined();
  });
});
