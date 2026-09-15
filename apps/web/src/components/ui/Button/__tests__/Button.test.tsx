import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

import { Button } from "..";

describe("Button", () => {
  it("defaults to type button so it does not submit a form", () => {
    render(<Button>Save</Button>);

    expect(screen.getByRole("button", { name: "Save" })).toHaveProperty("type", "button");
  });

  it("keeps compact padding by default and field padding when size is field", () => {
    const { rerender } = render(<Button>Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });

    expect(button.className).toContain("px-3");
    expect(button.className).toContain("py-1");

    rerender(
      <Button size="field" type="submit">
        Save
      </Button>,
    );

    expect(button.className).toContain("px-4");
    expect(button.className).toContain("py-2.5");
    expect(button).toHaveProperty("type", "submit");
  });

  it("forwards type reset to the native button", () => {
    render(<Button type="reset">Reset</Button>);

    expect(screen.getByRole("button", { name: "Reset" })).toHaveProperty("type", "reset");
  });

  it("forwards a ref to the native button", () => {
    const ref = createRef<HTMLButtonElement>();

    render(<Button ref={ref}>Save</Button>);

    expect(ref.current).toBe(screen.getByRole("button", { name: "Save" }));
  });
});
