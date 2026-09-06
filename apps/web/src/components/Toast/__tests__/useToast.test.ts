import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useToast } from "../useToast";

describe("useToast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not open when there is no message", () => {
    const { result } = renderHook(() => useToast());

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toBeUndefined();
  });

  it("does not close when there is no toast to close", () => {
    const { result } = renderHook(() => useToast(""));

    expect(result.current).toBeUndefined();
  });

  it("opens with the given message", () => {
    const { result } = renderHook(() => useToast("No Argent or Braavos wallet found"));

    expect(result.current).toEqual({
      isOpen: true,
      message: "No Argent or Braavos wallet found",
    });
  });

  it("keeps the message while closing and clears it after 300ms", () => {
    const { result, rerender } = renderHook(({ message }: { message?: string }) => useToast(message), {
      initialProps: { message: "No Argent or Braavos wallet found" },
    });

    rerender({ message: "" });

    expect(result.current).toEqual({
      isOpen: false,
      message: "No Argent or Braavos wallet found",
    });

    act(() => {
      vi.advanceTimersByTime(299);
    });

    expect(result.current).toEqual({
      isOpen: false,
      message: "No Argent or Braavos wallet found",
    });

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(result.current).toBeUndefined();
  });

  it("reopens with a new message", () => {
    const { result, rerender } = renderHook(({ message }: { message?: string }) => useToast(message), {
      initialProps: { message: "first" },
    });

    rerender({ message: "second" });

    expect(result.current).toEqual({
      isOpen: true,
      message: "second",
    });
  });
});
