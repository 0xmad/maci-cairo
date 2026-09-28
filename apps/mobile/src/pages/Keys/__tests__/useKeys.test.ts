import { act, renderHook, waitFor } from "@testing-library/react-native";
import * as ExpoClipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";

import { defaultUnboundUserKeys } from "../../../keys/defaultUnboundUserKeys";
import { fixedPublicKey, fixedRecord } from "../../../keys/testFixtures";
import { serializeUserPublicKey, type UnboundUserKeyRecord } from "../../../keys/unboundUserKey";
import { createMockRouter } from "../../../test/createMockRouter";
import { useKeys } from "../useKeys";

jest.mock("../../../keys/defaultUnboundUserKeys", () => ({
  defaultUnboundUserKeys: {
    load: jest.fn(),
    create: jest.fn(),
    clear: jest.fn(),
  },
}));

jest.mock("expo-clipboard", () => ({
  setStringAsync: jest.fn(),
}));

jest.mock("expo-router", () => ({
  useRouter: jest.fn(),
}));

jest.mock("react-native-toast-message", () => {
  const show = jest.fn();

  return {
    __esModule: true,
    default: Object.assign(() => null, { show, hide: jest.fn() }),
  };
});

const load = jest.mocked(defaultUnboundUserKeys.load);
const create = jest.mocked(defaultUnboundUserKeys.create);
const clear = jest.mocked(defaultUnboundUserKeys.clear);
const setStringAsync = jest.mocked(ExpoClipboard.setStringAsync);
const showToast = jest.mocked(Toast.show);
const useRouterMock = jest.mocked(useRouter);

describe("useKeys", () => {
  const replace = jest.fn();

  beforeEach(() => {
    load.mockReset();
    create.mockReset();
    clear.mockReset();
    setStringAsync.mockReset();
    showToast.mockReset();
    replace.mockReset();
    useRouterMock.mockReturnValue(createMockRouter({ replace }));
  });

  it("loads with no unbound key", async () => {
    load.mockResolvedValue(null);

    const { result } = await renderHook(() => useKeys());

    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });
    expect(result.current.record).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("loads an existing unbound key", async () => {
    load.mockResolvedValue(fixedRecord);

    const { result } = await renderHook(() => useKeys());

    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });
    expect(result.current.record).toEqual(fixedRecord);
    expect(result.current.error).toBeNull();
  });

  it("surfaces a load failure", async () => {
    load.mockRejectedValue(new Error("secure store unavailable"));

    const { result } = await renderHook(() => useKeys());

    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });
    expect(result.current.record).toBeNull();
    expect(result.current.error).toBe("Could not load keys.");
  });

  it("creates an unbound user private key", async () => {
    load.mockResolvedValue(null);
    create.mockResolvedValue(fixedRecord);

    const { result } = await renderHook(() => useKeys());

    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });

    await act(() => {
      result.current.onCreate();
    });

    await waitFor(() => {
      expect(result.current.record).toEqual(fixedRecord);
    });
    expect(result.current.error).toBeNull();
  });

  it("surfaces a create failure", async () => {
    load.mockResolvedValue(null);
    create.mockRejectedValue(new Error("secure store unavailable"));

    const { result } = await renderHook(() => useKeys());

    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });

    await act(() => {
      result.current.onCreate();
    });

    await waitFor(() => {
      expect(result.current.error).toBe("Could not create user private key.");
    });
    expect(result.current.record).toBeNull();
  });

  it("copies the serialized public key and shows a toast", async () => {
    load.mockResolvedValue(fixedRecord);
    setStringAsync.mockResolvedValue(true);

    const { result } = await renderHook(() => useKeys());

    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });

    await act(() => {
      result.current.onCopyPublicKey();
    });

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith({
        type: "success",
        text1: "Public key copied",
        visibilityTime: 2000,
        position: "bottom",
      });
    });
    expect(setStringAsync).toHaveBeenCalledWith(serializeUserPublicKey(fixedPublicKey));
  });

  it("does not copy when no unbound key exists", async () => {
    load.mockResolvedValue(null);

    const { result } = await renderHook(() => useKeys());

    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });

    await act(() => {
      result.current.onCopyPublicKey();
    });

    expect(setStringAsync).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });

  it("shows an error toast when clipboard copy fails", async () => {
    load.mockResolvedValue(fixedRecord);
    setStringAsync.mockRejectedValue(new Error("clipboard unavailable"));

    const { result } = await renderHook(() => useKeys());

    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });

    await act(() => {
      result.current.onCopyPublicKey();
    });

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith({
        type: "error",
        text1: "Could not copy public key",
        visibilityTime: 2000,
        position: "bottom",
      });
    });
  });

  it("clears the unbound key and navigates home", async () => {
    load.mockResolvedValue(fixedRecord);
    clear.mockResolvedValue(undefined);

    const { result } = await renderHook(() => useKeys());

    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });

    await act(() => {
      result.current.onClearUnboundKey();
    });

    await waitFor(() => {
      expect(result.current.record).toBeNull();
    });
    expect(clear).toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith("/");
    expect(result.current.error).toBeNull();
  });

  it("surfaces a clear failure", async () => {
    load.mockResolvedValue(fixedRecord);
    clear.mockRejectedValue(new Error("secure store unavailable"));

    const { result } = await renderHook(() => useKeys());

    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });

    await act(() => {
      result.current.onClearUnboundKey();
    });

    await waitFor(() => {
      expect(result.current.error).toBe("Could not clear unbound key.");
    });
    expect(result.current.record).toEqual(fixedRecord);
    expect(replace).not.toHaveBeenCalled();
  });

  it("ignores load success after unmount", async () => {
    let resolveLoad!: (value: UnboundUserKeyRecord | null) => void;
    const loadPromise = new Promise<UnboundUserKeyRecord | null>((resolve) => {
      resolveLoad = resolve;
    });
    load.mockReturnValue(loadPromise);

    const { result, unmount } = await renderHook(() => useKeys());

    expect(result.current.ready).toBe(false);

    await act(() => {
      unmount();
    });
    resolveLoad(fixedRecord);
    await loadPromise;
  });

  it("ignores load failure after unmount", async () => {
    let rejectLoad!: (reason?: unknown) => void;
    const loadPromise = new Promise<UnboundUserKeyRecord | null>((_, reject) => {
      rejectLoad = reject;
    });
    load.mockReturnValue(loadPromise);

    const { result, unmount } = await renderHook(() => useKeys());

    expect(result.current.ready).toBe(false);

    await act(() => {
      unmount();
    });
    rejectLoad(new Error("secure store unavailable"));
    await loadPromise.catch(() => undefined);
  });
});
