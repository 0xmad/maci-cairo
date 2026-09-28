import { act, renderHook, waitFor } from "@testing-library/react-native";

import { defaultUnboundUserKeys } from "../defaultUnboundUserKeys";
import { useHasUnboundKey } from "../useHasUnboundKey";

jest.mock("../defaultUnboundUserKeys", () => ({
  defaultUnboundUserKeys: {
    load: jest.fn(),
    create: jest.fn(),
    clear: jest.fn(),
  },
}));

const load = jest.mocked(defaultUnboundUserKeys.load);

describe("useHasUnboundKey", () => {
  beforeEach(() => {
    load.mockReset();
  });

  it("reports no key when load returns null", async () => {
    load.mockResolvedValue(null);

    const { result } = await renderHook(() => useHasUnboundKey());

    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });

    expect(result.current.hasKey).toBe(false);
  });

  it("reports a key when load returns a record", async () => {
    load.mockResolvedValue({
      privateKey: "99",
      publicKey: { x: "1", y: "2" },
    });

    const { result } = await renderHook(() => useHasUnboundKey());

    await waitFor(() => {
      expect(result.current.ready).toBe(true);
    });

    expect(result.current.hasKey).toBe(true);
  });

  it("reports no key when load fails", async () => {
    load.mockRejectedValue(new Error("store unavailable"));

    const { result } = await renderHook(() => useHasUnboundKey());

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

    const { result, unmount } = await renderHook(() => useHasUnboundKey());

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

    const { result, unmount } = await renderHook(() => useHasUnboundKey());

    expect(result.current.ready).toBe(false);

    await act(() => {
      unmount();
    });
    rejectLoad(new Error("store unavailable"));
    await loadPromise.catch(() => undefined);
  });
});
