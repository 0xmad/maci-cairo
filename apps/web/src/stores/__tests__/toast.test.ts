import { beforeEach, describe, expect, it, vi } from "vitest";

import { createToastStore } from "../toast.js";

const declareLeanImt = { seq: 1, kind: "declare", name: "LeanIMT" };
const deployLeanImt = { seq: 2, kind: "deploy", name: "leanImt" };

const errorToast = {
  id: "connect-wallet",
  duration: Number.POSITIVE_INFINITY,
  closeButton: true,
};

function host() {
  return {
    success: vi.fn(),
    error: vi.fn(),
  };
}

describe("toast store", () => {
  let toasts: ReturnType<typeof host>;

  beforeEach(() => {
    toasts = host();
  });

  it("shows a wallet error when the Operator is unsigned", () => {
    const store = createToastStore(toasts);

    store.getState().showConnectError({ walletError: "No Argent or Braavos wallet found" });

    expect(toasts.error).toHaveBeenCalledWith("No Argent or Braavos wallet found", errorToast);
  });

  it("shows a login error when there is no wallet error", () => {
    const store = createToastStore(toasts);

    store.getState().showConnectError({ loginError: "Sign-in failed" });

    expect(toasts.error).toHaveBeenCalledWith("Sign-in failed", errorToast);
  });

  it("prefers the wallet error over the login error", () => {
    const store = createToastStore(toasts);

    store.getState().showConnectError({ walletError: "wallet failed", loginError: "Sign-in failed" });

    expect(toasts.error).toHaveBeenCalledWith("wallet failed", errorToast);
  });

  it("does not toast errors after the Operator is signed in", () => {
    const store = createToastStore(toasts);

    store.getState().showConnectError({
      operator: "0xoperator",
      walletError: "wallet failed",
      loginError: "Sign-in failed",
    });

    expect(toasts.error).not.toHaveBeenCalled();
  });

  it("does not dismiss the connect toast when the error clears", () => {
    const store = createToastStore(toasts);
    store.getState().showConnectError({ walletError: "No Argent or Braavos wallet found" });
    toasts.error.mockClear();

    store.getState().showConnectError({ walletError: "" });

    expect(toasts.error).not.toHaveBeenCalled();
  });

  it("stacks a toast for each stand-up step while a job is running", () => {
    const store = createToastStore(toasts);

    store.getState().showStandUp({ running: true, steps: [declareLeanImt, deployLeanImt] });

    expect(toasts.success).toHaveBeenCalledWith("declare LeanIMT", {
      id: "maci-stand-up-step-1",
      duration: 4_000,
    });
    expect(toasts.success).toHaveBeenCalledWith("deploy leanImt", {
      id: "maci-stand-up-step-2",
      duration: Number.POSITIVE_INFINITY,
    });
  });

  it("does not toast previous steps while stand-up is not running", () => {
    const store = createToastStore(toasts);

    store.getState().showStandUp({ running: false, steps: [declareLeanImt] });

    expect(toasts.success).not.toHaveBeenCalled();
  });

  it("does not toast while a job is running with no steps yet", () => {
    const store = createToastStore(toasts);

    store.getState().showStandUp({ running: true, steps: [] });

    expect(toasts.success).not.toHaveBeenCalled();
  });

  it("keeps the last step visible for a timeout after the job stops", () => {
    const store = createToastStore(toasts);
    store.getState().showStandUp({ running: true, steps: [deployLeanImt] });
    toasts.success.mockClear();

    store.getState().showStandUp({ running: false, steps: [] });

    expect(toasts.success).toHaveBeenCalledWith("deploy leanImt", {
      id: "maci-stand-up-step-2",
      duration: 4_000,
    });
  });

  it("shows a stand-up error that only the close button can dismiss", () => {
    const store = createToastStore(toasts);

    store.getState().showStandUp({ running: false, steps: [], error: "busy" });

    expect(toasts.error).toHaveBeenCalledWith("busy", {
      id: "maci-stand-up-error",
      duration: Number.POSITIVE_INFINITY,
      closeButton: true,
    });
  });

  it("does not dismiss a stand-up error toast when the error clears", () => {
    const store = createToastStore(toasts);
    store.getState().showStandUp({ running: false, steps: [], error: "busy" });
    toasts.error.mockClear();

    store.getState().showStandUp({ running: false, steps: [], error: "" });

    expect(toasts.error).not.toHaveBeenCalled();
  });
});
