import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

import { Select } from "..";

describe("Select", () => {
  it("defaults to field size and renders native options", () => {
    render(
      <Select aria-label="Network">
        <option value="local">Starknet Local</option>
      </Select>,
    );

    const select = screen.getByRole("combobox", { name: "Network" });

    expect(select.className).toContain("h-11");
    expect(screen.getByRole("option", { name: "Starknet Local" })).toHaveProperty("value", "local");
  });

  it("uses compact padding when size is compact", () => {
    render(
      <Select aria-label="Network" size="compact">
        <option value="local">Starknet Local</option>
      </Select>,
    );

    expect(screen.getByRole("combobox", { name: "Network" }).className).toContain("py-1");
  });

  it("forwards a ref to the native select", () => {
    const ref = createRef<HTMLSelectElement>();

    render(
      <Select ref={ref} aria-label="Network">
        <option value="local">Starknet Local</option>
      </Select>,
    );

    expect(ref.current).toBe(screen.getByRole("combobox", { name: "Network" }));
  });
});
