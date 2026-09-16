import { describe, expect, it, vi } from "vitest";

import { createOperatorLoginStore } from "../operatorLogin.js";

describe("Operator login store", () => {
  it("restores the Operator from a session JWT", async () => {
    const readSession = vi.fn().mockResolvedValue("0xoperator");
    const store = createOperatorLoginStore({
      issueNonce: vi.fn(),
      login: vi.fn(),
      readSession,
    });

    await store.getState().restore("stored-jwt");

    expect(readSession).toHaveBeenCalledWith("stored-jwt");
    expect(store.getState().operator).toBe("0xoperator");
    expect(store.getState().restoring).toBe(false);
  });

  it("is restoring while a stored JWT session is read", () => {
    const store = createOperatorLoginStore({
      issueNonce: vi.fn(),
      login: vi.fn(),
      readSession: (): Promise<string> =>
        new Promise(() => {
          /* pending */
        }),
    });

    store
      .getState()
      .restore("stored-jwt")
      .catch(() => undefined);

    expect(store.getState().restoring).toBe(true);
    expect(store.getState().operator).toBeUndefined();
  });

  it("is not restoring when there is no stored JWT", async () => {
    const readSession = vi.fn();
    const store = createOperatorLoginStore({
      issueNonce: vi.fn(),
      login: vi.fn(),
      readSession,
    });

    await store.getState().restore(undefined);

    expect(readSession).not.toHaveBeenCalled();
    expect(store.getState().restoring).toBe(false);
  });

  it("clears the Operator when session restore fails", async () => {
    const store = createOperatorLoginStore({
      issueNonce: vi.fn(),
      login: vi.fn(),
      readSession: vi.fn().mockRejectedValue(new Error("expired")),
    });

    await expect(store.getState().restore("stored-jwt")).rejects.toThrow("expired");
    expect(store.getState().operator).toBeUndefined();
    expect(store.getState().restoring).toBe(false);
  });

  it("ignores a stale restore", async () => {
    let resolveFirst: (address: string) => void = (): void => undefined;
    const readSession = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<string>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce("0xlater");
    const store = createOperatorLoginStore({
      issueNonce: vi.fn(),
      login: vi.fn(),
      readSession,
    });
    const first = store.getState().restore("jwt-1");
    const second = store.getState().restore("jwt-2");

    await second;
    resolveFirst("0xfirst");
    await first;

    expect(store.getState().operator).toBe("0xlater");
  });

  it("ignores a stale restore failure", async () => {
    let rejectFirst: (reason: unknown) => void = (): void => undefined;
    const readSession = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<string>((_resolve, reject) => {
            rejectFirst = reject;
          }),
      )
      .mockResolvedValueOnce("0xlater");
    const store = createOperatorLoginStore({
      issueNonce: vi.fn(),
      login: vi.fn(),
      readSession,
    });
    const first = store.getState().restore("jwt-1");
    const second = store.getState().restore("jwt-2");

    await second;
    rejectFirst(new Error("expired"));
    await expect(first).rejects.toThrow("expired");

    expect(store.getState().operator).toBe("0xlater");
    expect(store.getState().restoring).toBe(false);
  });

  it("asks to connect a wallet before sign-in", async () => {
    const issueNonce = vi.fn();
    const store = createOperatorLoginStore({
      issueNonce,
      login: vi.fn(),
      readSession: vi.fn(),
    });

    await store.getState().signIn(undefined, vi.fn());

    expect(store.getState().error).toBe("Connect a wallet first");
    expect(issueNonce).not.toHaveBeenCalled();
  });

  it("records an Error message when sign-in fails", async () => {
    const store = createOperatorLoginStore({
      issueNonce: vi.fn().mockResolvedValue("nonce-1"),
      login: vi.fn(),
      readSession: vi.fn(),
    });

    await expect(
      store.getState().signIn("0xwallet", () => Promise.reject(new Error("user rejected"))),
    ).resolves.toBeUndefined();
    expect(store.getState().error).toBe("user rejected");
  });

  it("uses Sign-in failed when the rejection is not an Error", async () => {
    const store = createOperatorLoginStore({
      issueNonce: vi.fn().mockResolvedValue("nonce-1"),
      login: vi.fn(),
      readSession: vi.fn(),
    });

    await store.getState().signIn("0xwallet", () =>
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- catch must map non-Errors to "Sign-in failed"
      Promise.reject("wallet unavailable"),
    );

    expect(store.getState().error).toBe("Sign-in failed");
  });

  it("returns a JWT and Operator address after sign-in", async () => {
    const issueNonce = vi.fn().mockResolvedValue("nonce-1");
    const login = vi.fn().mockResolvedValue({ token: "jwt", address: "0xoperator" });
    const signNonce = vi.fn().mockResolvedValue(["0x1", "0x2"]);
    const store = createOperatorLoginStore({
      issueNonce,
      login,
      readSession: vi.fn(),
    });

    const token = await store.getState().signIn("0xwallet", signNonce);

    expect(signNonce).toHaveBeenCalledWith("nonce-1");
    expect(login).toHaveBeenCalledWith("nonce-1", JSON.stringify({ address: "0xwallet", signature: ["0x1", "0x2"] }));
    expect(token).toBe("jwt");
    expect(store.getState().operator).toBe("0xoperator");
  });

  it("resets Operator login state", async () => {
    const store = createOperatorLoginStore({
      issueNonce: vi.fn(),
      login: vi.fn(),
      readSession: vi.fn().mockResolvedValue("0xoperator"),
    });

    await store.getState().restore("jwt");
    store.getState().reset();

    expect(store.getState().operator).toBeUndefined();
    expect(store.getState().error).toBeUndefined();
    expect(store.getState().restoring).toBe(false);
  });
});
