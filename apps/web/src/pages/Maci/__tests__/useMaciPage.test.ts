import { act, renderHook } from "@testing-library/react";
import { type SyntheticEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useMaciPage } from "../useMaciPage";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("react-router-dom");

  return {
    ...actual,
    useNavigate: vi.fn(),
    useParams: vi.fn(),
  };
});

const useNavigateMock = vi.mocked(useNavigate);
const useParamsMock = vi.mocked(useParams);
const navigate = vi.fn();

const changeEvent = (value: string): SyntheticEvent<HTMLInputElement> =>
  ({
    currentTarget: { value },
  }) as SyntheticEvent<HTMLInputElement>;

const submitEvent = (preventDefault: ReturnType<typeof vi.fn>): SyntheticEvent<HTMLFormElement> =>
  ({
    preventDefault,
  }) as unknown as SyntheticEvent<HTMLFormElement>;

describe("useMaciPage", () => {
  beforeEach(() => {
    navigate.mockReset();
    useNavigateMock.mockReturnValue(navigate);
    useParamsMock.mockReturnValue({});
  });

  it("starts with an empty draft when the URL has no address", () => {
    const { result } = renderHook(() => useMaciPage());

    expect(result.current.address).toBeUndefined();
    expect(result.current.draft).toBe("");
    expect(result.current.hasMaci).toBe(false);
  });

  it("uses the URL address and treats it as a selected MACI", () => {
    useParamsMock.mockReturnValue({ address: "0xabc123" });

    const { result } = renderHook(() => useMaciPage());

    expect(result.current.address).toBe("0xabc123");
    expect(result.current.draft).toBe("0xabc123");
    expect(result.current.hasMaci).toBe(true);
  });

  it("does not treat an empty URL address as a selected MACI", () => {
    useParamsMock.mockReturnValue({ address: "" });

    const { result } = renderHook(() => useMaciPage());

    expect(result.current.address).toBe("");
    expect(result.current.hasMaci).toBe(false);
  });

  it("updates the draft from the input", () => {
    const { result } = renderHook(() => useMaciPage());

    act(() => {
      result.current.handleChange(changeEvent("0xdef"));
    });

    expect(result.current.draft).toBe("0xdef");
  });

  it("navigates to the trimmed draft on submit", () => {
    const { result } = renderHook(() => useMaciPage());
    const preventDefault = vi.fn();

    act(() => {
      result.current.handleChange(changeEvent("  0xabc  "));
    });

    act(() => {
      result.current.handleSubmit(submitEvent(preventDefault));
    });

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("/maci/0xabc");
  });

  it("does not navigate when the draft is empty after trim", () => {
    const { result } = renderHook(() => useMaciPage());
    const preventDefault = vi.fn();

    act(() => {
      result.current.handleChange(changeEvent("   "));
    });

    act(() => {
      result.current.handleSubmit(submitEvent(preventDefault));
    });

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });
});
