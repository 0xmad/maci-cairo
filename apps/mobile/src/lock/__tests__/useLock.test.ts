import { act, renderHook, waitFor } from "@testing-library/react-native";

import { latestAppActivity, resetAppActivity, watchAppActivity } from "../../test/appActivity";
import {
  authenticationCallCount,
  queueAuthenticationResults,
  resetLocalAuthentication,
} from "../../test/localAuthenticationState";
import { createLock } from "../createLock";
import { useLock } from "../useLock";

jest.mock("expo-local-authentication");

describe("useLock", () => {
  beforeEach(() => {
    resetAppActivity();
    resetLocalAuthentication();
    watchAppActivity();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("covers the client when the app leaves the foreground and prompts again on return", async () => {
    queueAuthenticationResults(["success", "success"]);
    const lock = createLock();
    const { result } = await renderHook(() => useLock(lock));

    await waitFor(() => {
      expect(result.current.view).toEqual({ status: "open" });
    });

    await act(async () => {
      latestAppActivity()("active");
      await Promise.resolve();
    });

    await act(async () => {
      latestAppActivity()("inactive");
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(lock.view()).toEqual({ status: "closed", reason: "prompting" });
      expect(result.current.view).toEqual({ status: "closed", reason: "prompting" });
    });

    await act(async () => {
      latestAppActivity()("active");
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.view).toEqual({ status: "open" });
    });
    expect(authenticationCallCount()).toBe(2);
  });

  it("does not prompt again when the app becomes active after a dismiss", async () => {
    queueAuthenticationResults(["dismissed", "dismissed"]);
    const lock = createLock();
    const { result } = await renderHook(() => useLock(lock));

    await waitFor(() => {
      expect(result.current.view).toEqual({ status: "closed", reason: "dismissed" });
    });

    await act(async () => {
      latestAppActivity()("active");
      await Promise.resolve();
    });

    expect(result.current.view).toEqual({ status: "closed", reason: "dismissed" });
    expect(authenticationCallCount()).toBe(1);

    await act(async () => {
      latestAppActivity()("background");
      await Promise.resolve();
    });
    await act(async () => {
      latestAppActivity()("active");
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.view).toEqual({ status: "closed", reason: "dismissed" });
    });
    expect(authenticationCallCount()).toBe(2);
  });

  it("opens the visit when retry raises the prompt again", async () => {
    queueAuthenticationResults(["dismissed", "success"]);
    const lock = createLock();
    const { result } = await renderHook(() => useLock(lock));

    await waitFor(() => {
      expect(result.current.view).toEqual({ status: "closed", reason: "dismissed" });
    });

    await act(async () => {
      result.current.retry();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.view).toEqual({ status: "open" });
    });
  });

  it("stays closed when retry's prompt fails", async () => {
    queueAuthenticationResults(["dismissed", "failed"]);
    const lock = createLock();
    const { result } = await renderHook(() => useLock(lock));

    await waitFor(() => {
      expect(result.current.view).toEqual({ status: "closed", reason: "dismissed" });
    });

    await act(async () => {
      result.current.retry();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.view).toEqual({ status: "closed", reason: "dismissed" });
    });
  });
});
