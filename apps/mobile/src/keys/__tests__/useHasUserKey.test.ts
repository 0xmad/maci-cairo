import { act, renderHook, waitFor } from "@testing-library/react-native";

import { defaultMaciBinding } from "../defaultMaciBinding";
import { defaultUnboundUserKeys } from "../defaultUnboundUserKeys";
import { useHasUserKey } from "../useHasUserKey";

jest.mock("../defaultUnboundUserKeys", () => ({
  defaultUnboundUserKeys: {
    load: jest.fn(),
    create: jest.fn(),
    clear: jest.fn(),
  },
}));

jest.mock("../defaultMaciBinding", () => ({
  defaultMaciBinding: {
    load: jest.fn(),
    hasStoredBinding: jest.fn(),
    bind: jest.fn(),
  },
}));

const load = jest.mocked(defaultUnboundUserKeys.load);
const hasStoredBinding = jest.mocked(defaultMaciBinding.hasStoredBinding);

describe("useHasUserKey", () => {
  beforeEach(() => {
    load.mockReset();
    hasStoredBinding.mockReset();
    hasStoredBinding.mockResolvedValue(false);
  });

  it("reports no key when nothing is stored", async () => {
    load.mockResolvedValue(null);

    const { result } = await renderHook(() => useHasUserKey());

    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });

    expect(result.current.hasKey).toBe(false);
  });

  it("reports a key when an unbound key is stored", async () => {
    load.mockResolvedValue({
      publicKey: { x: "1", y: "2" },
    });

    const { result } = await renderHook(() => useHasUserKey());

    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });

    expect(result.current.hasKey).toBe(true);
  });

  it("reports a key when a MACI binding is stored", async () => {
    load.mockResolvedValue(null);
    hasStoredBinding.mockResolvedValue(true);

    const { result } = await renderHook(() => useHasUserKey());

    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });

    expect(result.current.hasKey).toBe(true);
  });

  it("reports no key when load fails", async () => {
    load.mockRejectedValue(new Error("store unavailable"));

    const { result } = await renderHook(() => useHasUserKey());

    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });

    expect(result.current.hasKey).toBe(false);
  });

  it("ignores load result after unmount", async () => {
    let resolveLoad!: (value: null) => void;
    const loadPromise = new Promise<null>((resolve) => {
      resolveLoad = resolve;
    });
    load.mockReturnValue(loadPromise);

    const { result, unmount } = await renderHook(() => useHasUserKey());

    expect(result.current.ready).toBe(false);

    await act(() => {
      unmount();
    });
    resolveLoad(null);
    await loadPromise;
  });

  it("ignores load failure after unmount", async () => {
    let rejectLoad!: (reason?: unknown) => void;
    const loadPromise = new Promise<null>((_, reject) => {
      rejectLoad = reject;
    });
    load.mockReturnValue(loadPromise);

    const { result, unmount } = await renderHook(() => useHasUserKey());

    expect(result.current.ready).toBe(false);

    await act(() => {
      unmount();
    });
    rejectLoad(new Error("store unavailable"));
    await loadPromise.catch(() => undefined);
  });
});
