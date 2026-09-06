import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Toast } from "..";
import { useToast } from "../useToast";

vi.mock("../useToast", () => ({
  useToast: vi.fn(),
}));

const useToastMock = vi.mocked(useToast);

describe("Toast", () => {
  it("renders nothing when the hook has no toast", () => {
    useToastMock.mockReturnValue(undefined);

    render(<Toast message="No Argent or Braavos wallet found" />);

    expect(screen.queryByRole("status")).toBeNull();
  });

  it("renders an open toast from the hook", () => {
    useToastMock.mockReturnValue({
      isOpen: true,
      message: "No Argent or Braavos wallet found",
    });

    render(<Toast />);

    const status = screen.getByRole("status");

    expect(status.textContent).toBe("No Argent or Braavos wallet found");
    expect(status.getAttribute("data-open")).toBe("true");
  });

  it("keeps the message visible while the toast is closing", () => {
    useToastMock.mockReturnValue({
      isOpen: false,
      message: "No Argent or Braavos wallet found",
    });

    render(<Toast />);

    const status = screen.getByRole("status");

    expect(status.textContent).toBe("No Argent or Braavos wallet found");
    expect(status.getAttribute("data-open")).toBe("false");
  });
});
