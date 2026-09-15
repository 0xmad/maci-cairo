import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Field, FieldError } from "..";
import { Input } from "../../Input";
import { Label } from "../../Label";
import { Select } from "../../Select";

describe("Field", () => {
  it("associates the label with the control", () => {
    render(
      <Field>
        <Label>Constant amount</Label>

        <Input />
      </Field>,
    );

    expect(screen.getByLabelText("Constant amount")).toBeTruthy();
  });

  it("does not render an alert when FieldError has no message", () => {
    const { rerender } = render(
      <Field>
        <Label>Constant amount</Label>

        <Input />

        <FieldError>{undefined}</FieldError>
      </Field>,
    );

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByLabelText("Constant amount").getAttribute("aria-invalid")).toBeNull();
    expect(screen.getByLabelText("Constant amount").getAttribute("aria-describedby")).toBeNull();

    const emptyMessage = "";

    rerender(
      <Field>
        <Label>Constant amount</Label>

        <Input />

        <FieldError>{emptyMessage}</FieldError>
      </Field>,
    );

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByLabelText("Constant amount").getAttribute("aria-describedby")).toBeNull();
  });

  it("binds the error alert to the control", () => {
    render(
      <Field>
        <Label>Constant amount</Label>

        <Input />

        <FieldError>Constant amount must be a positive integer</FieldError>
      </Field>,
    );

    const input = screen.getByLabelText("Constant amount");
    const errorAlert = screen.getByRole("alert");

    expect(errorAlert.textContent).toBe("Constant amount must be a positive integer");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe(errorAlert.id);
  });

  it("binds the error alert to a select", () => {
    render(
      <Field>
        <Label>Circuit profile</Label>

        <Select>
          <option value="small">small</option>
        </Select>

        <FieldError>Choose a circuit profile</FieldError>
      </Field>,
    );

    const select = screen.getByLabelText("Circuit profile");
    const errorAlert = screen.getByRole("alert");

    expect(select.getAttribute("aria-invalid")).toBe("true");
    expect(select.getAttribute("aria-describedby")).toBe(errorAlert.id);
  });

  it("renders a non-text error node as an alert", () => {
    render(
      <Field>
        <Label>Constant amount</Label>

        <Input />

        <FieldError>
          <span>Constant amount must be a positive integer</span>
        </FieldError>
      </Field>,
    );

    expect(screen.getByRole("alert").textContent).toBe("Constant amount must be a positive integer");
  });

  it("renders an alert without a Field", () => {
    render(<FieldError>Constant amount must be a positive integer</FieldError>);

    expect(screen.getByRole("alert").textContent).toBe("Constant amount must be a positive integer");
  });
});
