import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MaciPage } from "..";
import { useMaciPage } from "../useMaciPage";

vi.mock("../useMaciPage", () => ({
  useMaciPage: vi.fn(),
}));

const useMaciPageMock = vi.mocked(useMaciPage);

describe("MaciPage", () => {
  const handleChange = vi.fn();
  const handleSubmit = vi.fn();

  beforeEach(() => {
    handleChange.mockReset();
    handleSubmit.mockReset();
  });

  it("prompts to paste an address when no MACI is selected", () => {
    useMaciPageMock.mockReturnValue({
      draft: "",
      handleChange,
      handleSubmit,
      hasMaci: false,
    });

    render(<MaciPage />);

    expect(screen.getByRole("heading", { name: "MACI" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "MACI address" })).toHaveProperty("value", "");
    expect(screen.getByText("Paste a MACI address. No chain reads in this scaffold.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create Poll" })).toHaveProperty("disabled", true);
    expect(screen.queryByText("Create Poll is not wired and sends no transaction.")).toBeNull();
  });

  it("shows the selected MACI and enables Create Poll", () => {
    useMaciPageMock.mockReturnValue({
      address: "0xabc123",
      draft: "0xabc123",
      handleChange,
      handleSubmit,
      hasMaci: true,
    });

    render(<MaciPage />);

    expect(screen.getByRole("textbox", { name: "MACI address" })).toHaveProperty("value", "0xabc123");
    expect(screen.getByText("0xabc123")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create Poll" })).toHaveProperty("disabled", false);
    expect(screen.getByText("Create Poll is not wired and sends no transaction.")).toBeTruthy();
  });

  it("forwards address input and Open submit to the hook", () => {
    useMaciPageMock.mockReturnValue({
      draft: "",
      handleChange,
      handleSubmit,
      hasMaci: false,
    });

    render(<MaciPage />);

    fireEvent.change(screen.getByRole("textbox", { name: "MACI address" }), {
      target: { value: "0xdef" },
    });

    const form = screen.getByRole("button", { name: "Open" }).closest("form");

    expect(form).toBeTruthy();

    if (form !== null) {
      fireEvent.submit(form);
    }

    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleSubmit).toHaveBeenCalledTimes(1);
  });
});
