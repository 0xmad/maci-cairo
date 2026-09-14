import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { StandUpIntentForm } from "../StandUpIntentForm";

const CATALOG = {
  circuitProfiles: [
    { id: "small", maxSignups: 32, maxVoteOptions: 5 },
    { id: "medium", maxSignups: 64, maxVoteOptions: 10 },
  ],
  policies: [{ id: "Free for all" }],
  assigners: [{ id: "Constant vote balance" }],
};

describe("StandUpIntentForm", () => {
  it("updates Max Signups and Max vote options when the circuit profile changes", () => {
    render(<StandUpIntentForm catalog={CATALOG} running={false} starting={false} onStart={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Circuit profile"), { target: { value: "medium" } });

    expect(screen.getByText("64")).toBeTruthy();
    expect(screen.getByText("10")).toBeTruthy();
  });

  it("keeps the first circuit profile limits when the selected id is unknown", () => {
    render(<StandUpIntentForm catalog={CATALOG} running={false} starting={false} onStart={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Circuit profile"), { target: { value: "medium" } });
    expect(screen.getByText("64")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Circuit profile"), { target: { value: "gone" } });

    expect(screen.getByText("32")).toBeTruthy();
    expect(screen.getByText("5")).toBeTruthy();
    expect(screen.queryByText("64")).toBeNull();
  });

  it("does not start stand-up when policy and assigner catalogs are empty", async () => {
    const onStart = vi.fn();

    render(
      <StandUpIntentForm
        catalog={{ ...CATALOG, policies: [], assigners: [] }}
        running={false}
        starting={false}
        onStart={onStart}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Start MACI stand-up" }));

    await Promise.resolve();
    expect(onStart).not.toHaveBeenCalled();
  });

  it("does not throw when start fails", async () => {
    const onStart = vi.fn().mockRejectedValue(new Error("busy"));

    render(<StandUpIntentForm catalog={CATALOG} running={false} starting={false} onStart={onStart} />);

    fireEvent.click(screen.getByRole("button", { name: "Start MACI stand-up" }));

    await waitFor(() => {
      expect(onStart).toHaveBeenCalled();
    });
    expect(screen.getByRole("button", { name: "Start MACI stand-up" })).toBeTruthy();
  });
});
