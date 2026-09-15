import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

import { Input } from "..";

describe("Input", () => {
  it("renders a field-sized textbox and forwards a ref", () => {
    const ref = createRef<HTMLInputElement>();

    render(<Input ref={ref} aria-label="Constant amount" name="voteBalance" />);

    const input = screen.getByRole("textbox", { name: "Constant amount" });

    expect(input.className).toContain("h-11");
    expect(input).toHaveProperty("name", "voteBalance");
    expect(ref.current).toBe(input);
  });
});
