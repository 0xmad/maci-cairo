import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OpsClient } from "../../../services/ops";
import { operatorNonceMessage } from "../../../services/ops/nonceMessage";
import { useOperatorSession } from "../../../stores/operatorSession";
import { useOperatorLogin } from "../useOperatorLogin";

const { signMock, storeJwtMock, readStoredJwtMock, clearStoredJwtMock, issueNonceMock, loginMock, readSessionMock } =
  vi.hoisted(() => ({
    signMock: vi.fn(),
    storeJwtMock: vi.fn(),
    readStoredJwtMock: vi.fn(),
    clearStoredJwtMock: vi.fn(),
    issueNonceMock: vi.fn(),
    loginMock: vi.fn(),
    readSessionMock: vi.fn(),
  }));

vi.mock("../../../providers/Network", () => ({
  useNetwork: (): {
    network: "local";
    sdk: { getProvider: () => { getChainId: () => Promise<string> } };
  } => ({
    network: "local",
    sdk: {
      getProvider: (): { getChainId: () => Promise<string> } => ({
        getChainId: (): Promise<string> => Promise.resolve("0x534e5f5345504f4c4941"),
      }),
    },
  }),
}));

vi.mock("../../../config/network", () => ({
  rpcUrlFor: (): string => "http://rpc.test/",
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

vi.mock("../../../services/wallet", () => ({
  wallet: {
    signMessage: signMock,
  },
}));

const OpsClientMock = vi.mocked(OpsClient);

describe("useOperatorLogin", () => {
  beforeEach(() => {
    OpsClientMock.mockReset();
    storeJwtMock.mockReset();
    readStoredJwtMock.mockReset();
    clearStoredJwtMock.mockReset();
    issueNonceMock.mockReset();
    loginMock.mockReset();
    readSessionMock.mockReset();
    signMock.mockReset();
    readStoredJwtMock.mockReturnValue(undefined);
    useOperatorSession.setState({ token: undefined });
    signMock.mockResolvedValue(["0x1", "0x2"]);
    issueNonceMock.mockResolvedValue("nonce-1");
    loginMock.mockResolvedValue({
      token: "jwt",
      address: "0xoperator",
    });
    OpsClientMock.mockImplementation(
      class {
        issueNonce = issueNonceMock;

        login = loginMock;

        readSession = readSessionMock;
      } as unknown as typeof OpsClient,
    );
  });

  it("restores the Operator from a stored JWT", async () => {
    readStoredJwtMock.mockReturnValue("stored-jwt");
    useOperatorSession.setState({ token: "stored-jwt" });
    readSessionMock.mockResolvedValue("0xoperator");

    const { result } = renderHook(() => useOperatorLogin());

    await waitFor(() => {
      expect(result.current.operator).toBe("0xoperator");
    });
    expect(readSessionMock).toHaveBeenCalledWith("stored-jwt");
    expect(result.current.restoring).toBe(false);
  });

  it("is restoring while a stored JWT session is read", () => {
    readStoredJwtMock.mockReturnValue("stored-jwt");
    useOperatorSession.setState({ token: "stored-jwt" });
    readSessionMock.mockImplementation(
      (): Promise<string> =>
        new Promise(() => {
          /* pending */
        }),
    );

    const { result } = renderHook(() => useOperatorLogin());

    expect(result.current.restoring).toBe(true);
    expect(result.current.operator).toBeUndefined();
  });

  it("is not restoring when there is no stored JWT", () => {
    const { result } = renderHook(() => useOperatorLogin());

    expect(result.current.restoring).toBe(false);
  });

  it("clears a stored JWT when session restore fails", async () => {
    readStoredJwtMock.mockReturnValue("stored-jwt");
    useOperatorSession.setState({ token: "stored-jwt" });
    readSessionMock.mockRejectedValue(new Error("expired"));

    const { result } = renderHook(() => useOperatorLogin());

    await waitFor(() => {
      expect(clearStoredJwtMock).toHaveBeenCalled();
    });
    expect(result.current.restoring).toBe(false);
  });

  it("does not restore the Operator after unmount", async () => {
    let resolveSession: (address: string) => void = (): void => undefined;

    readStoredJwtMock.mockReturnValue("stored-jwt");
    useOperatorSession.setState({ token: "stored-jwt" });
    readSessionMock.mockImplementation(
      (): Promise<string> =>
        new Promise((resolve) => {
          resolveSession = resolve;
        }),
    );

    const { result, unmount } = renderHook(() => useOperatorLogin());

    unmount();

    await act(async () => {
      resolveSession("0xoperator");
      await Promise.resolve();
    });

    expect(result.current.operator).toBeUndefined();
  });

  it("asks to connect a wallet before sign-in", async () => {
    const { result } = renderHook(() => useOperatorLogin());

    await act(async () => {
      await result.current.signIn();
    });

    expect(result.current.error).toBe("Connect a wallet first");
    expect(issueNonceMock).not.toHaveBeenCalled();
  });

  it("records an Error message when sign-in fails", async () => {
    signMock.mockRejectedValue(new Error("user rejected"));

    const { result } = renderHook(() => useOperatorLogin("0xwallet"));

    await act(async () => {
      await result.current.signIn();
    });

    expect(result.current.error).toBe("user rejected");
    expect(storeJwtMock).not.toHaveBeenCalled();
  });

  it("uses Sign-in failed when the rejection is not an Error", async () => {
    signMock.mockRejectedValue("wallet unavailable");

    const { result } = renderHook(() => useOperatorLogin("0xwallet"));

    await act(async () => {
      await result.current.signIn();
    });

    expect(result.current.error).toBe("Sign-in failed");
  });

  it("stores a JWT and exposes the Operator address after sign-in", async () => {
    const { result } = renderHook(() => useOperatorLogin("0xwallet"));

    await act(async () => {
      await result.current.signIn();
    });

    expect(signMock).toHaveBeenCalledWith("http://rpc.test/", operatorNonceMessage("nonce-1", "SN_SEPOLIA"));
    expect(loginMock).toHaveBeenCalledWith(
      "nonce-1",
      JSON.stringify({ address: "0xwallet", signature: ["0x1", "0x2"] }),
    );
    expect(storeJwtMock).toHaveBeenCalledWith("jwt");
    expect(result.current.operator).toBe("0xoperator");
  });

  it("clears the stored JWT and Operator on sign-out", async () => {
    const { result } = renderHook(() => useOperatorLogin("0xwallet"));

    await act(async () => {
      await result.current.signIn();
    });

    act(() => {
      result.current.signOut();
    });

    expect(clearStoredJwtMock).toHaveBeenCalled();
    expect(result.current.operator).toBeUndefined();
  });
});
