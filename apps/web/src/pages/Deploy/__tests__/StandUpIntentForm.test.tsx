import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { StandUpIntentForm, type StandUpIntentFormProps } from "../StandUpIntentForm";

const CATALOG = {
  circuitProfiles: [
    { id: "small", maxSignups: 32, maxVoteOptions: 5 },
    { id: "medium", maxSignups: 64, maxVoteOptions: 10 },
  ],
  policies: [{ id: "Free for all" }],
  assigners: [{ id: "Constant vote balance" }],
};

function renderForm(props: Partial<StandUpIntentFormProps> = {}): void {
  render(
    <StandUpIntentForm
      catalog={CATALOG}
      discarding={false}
      incompleteStandUp={false}
      running={false}
      starting={false}
      onDiscard={vi.fn()}
      onStart={vi.fn()}
      {...props}
    />,
  );
}

describe("StandUpIntentForm", () => {
  it("updates Max Signups and Max vote options when the circuit profile changes", () => {
    renderForm();

    fireEvent.change(screen.getByLabelText("Circuit profile"), { target: { value: "medium" } });

    expect(screen.getByText("64")).toBeTruthy();
    expect(screen.getByText("10")).toBeTruthy();
  });

  it("keeps the first circuit profile limits when the selected id is unknown", () => {
    renderForm();

    fireEvent.change(screen.getByLabelText("Circuit profile"), { target: { value: "medium" } });
    expect(screen.getByText("64")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Circuit profile"), { target: { value: "gone" } });

    expect(screen.getByText("32")).toBeTruthy();
    expect(screen.getByText("5")).toBeTruthy();
    expect(screen.queryByText("64")).toBeNull();
  });

  it("does not start stand-up when policy and assigner catalogs are empty", async () => {
    const onStart = vi.fn();

    renderForm({ catalog: { ...CATALOG, policies: [], assigners: [] }, onStart });

    fireEvent.click(screen.getByRole("button", { name: "Start MACI stand-up" }));

    await Promise.resolve();
    expect(onStart).not.toHaveBeenCalled();
  });

  it("does not throw when start fails", async () => {
    const onStart = vi.fn().mockRejectedValue(new Error("busy"));

    renderForm({ onStart });

    fireEvent.click(screen.getByRole("button", { name: "Start MACI stand-up" }));

    await waitFor(() => {
      expect(onStart).toHaveBeenCalled();
    });
    expect(screen.getByRole("button", { name: "Start MACI stand-up" })).toBeTruthy();
  });

  it("offers retry of the same job when stand-up is incomplete", () => {
    renderForm({ incompleteStandUp: true });

    expect(screen.getByRole("button", { name: "Retry MACI stand-up" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Start MACI stand-up" })).toBeNull();
    expect(screen.getByText(/Retry continues the same job/u)).toBeTruthy();
  });

  it("discards an incomplete stand-up when idle", async () => {
    const onDiscard = vi.fn().mockResolvedValue(undefined);

    renderForm({ incompleteStandUp: true, onDiscard });

    fireEvent.click(screen.getByRole("button", { name: "Discard incomplete stand-up" }));

    await waitFor(() => {
      expect(onDiscard).toHaveBeenCalledOnce();
    });
  });

  it("does not throw when discard fails", async () => {
    const onDiscard = vi.fn().mockRejectedValue(new Error("busy"));

    renderForm({ incompleteStandUp: true, onDiscard });

    fireEvent.click(screen.getByRole("button", { name: "Discard incomplete stand-up" }));

    await waitFor(() => {
      expect(onDiscard).toHaveBeenCalledOnce();
    });
    expect(screen.getByRole("button", { name: "Discard incomplete stand-up" })).toBeTruthy();
  });

  it("does not offer retry while a job is running", () => {
    renderForm({ incompleteStandUp: true, running: true });

    expect(screen.queryByRole("button", { name: "Retry MACI stand-up" })).toBeNull();
    expect(screen.getByRole("button", { name: "Start MACI stand-up" })).toHaveProperty("disabled", true);
  });

  it("does not offer discard while a job is starting", () => {
    renderForm({ incompleteStandUp: true, starting: true });

    expect(screen.queryByRole("button", { name: "Discard incomplete stand-up" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Retry MACI stand-up" })).toBeNull();
    expect(screen.getByRole("button", { name: "Start MACI stand-up" })).toHaveProperty("disabled", true);
  });
});
