import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { startOfLocalDay, unixSecondsFromDatetimeLocal } from "../../../utils/datetimeLocal.js";
import { CreatePollForm } from "../CreatePollForm";

const START = "2026-12-01T10:00";
const END = "2026-12-02T10:00";
const PACKED_BASE8_TIMES_7 = "70008494660785291157975070056351657766453235060722719811564206518804361908001";

describe("CreatePollForm", () => {
  it("starts Create Poll with schedule and Poll public key", async () => {
    const onStart = vi.fn().mockResolvedValue(undefined);

    render(<CreatePollForm available running={false} starting={false} onStart={onStart} />);

    fireEvent.change(screen.getByLabelText("Start date"), { target: { value: START } });
    fireEvent.change(screen.getByLabelText("End date"), { target: { value: END } });
    fireEvent.change(screen.getByLabelText("Poll public key"), {
      target: {
        value: PACKED_BASE8_TIMES_7,
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Poll" }));

    await waitFor(() => {
      expect(onStart).toHaveBeenCalledWith({
        startDate: unixSecondsFromDatetimeLocal(START),
        endDate: unixSecondsFromDatetimeLocal(END),
        pollPublicKey: [
          "20092560661213339045022877747484245238324772779820628739268223482659246842641",
          "12112450042127193446189577552007703839818242727902437791835414514847797088033",
        ],
      });
    });
  });

  it("uses datetime-local inputs and a full-width Create Poll button", () => {
    render(<CreatePollForm available running={false} starting={false} onStart={vi.fn()} />);

    expect(screen.getByLabelText("Start date")).toHaveProperty("type", "datetime-local");
    expect(screen.getByLabelText("End date")).toHaveProperty("type", "datetime-local");
    expect(screen.getByLabelText("Start date")).toHaveProperty("min", startOfLocalDay(new Date()));
    expect(screen.getByRole("button", { name: "Create Poll" }).className).toMatch(/\bw-full\b/u);
  });

  it("does not start Create Poll when the public key is not packed", async () => {
    const onStart = vi.fn().mockResolvedValue(undefined);

    render(<CreatePollForm available running={false} starting={false} onStart={onStart} />);

    fireEvent.change(screen.getByLabelText("Poll public key"), { target: { value: "hello" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Poll" }));

    await waitFor(() => {
      expect(screen.getByText("Invalid Poll public key")).toBeTruthy();
    });
    expect(onStart).not.toHaveBeenCalled();
  });

  it("keeps the form when Create Poll fails to start", async () => {
    const onStart = vi.fn().mockRejectedValue(new Error("busy"));

    render(<CreatePollForm available running={false} starting={false} onStart={onStart} />);
    fireEvent.change(screen.getByLabelText("Start date"), { target: { value: START } });
    fireEvent.change(screen.getByLabelText("End date"), { target: { value: END } });
    fireEvent.click(screen.getByRole("button", { name: "Create Poll" }));

    await waitFor(() => {
      expect(onStart).toHaveBeenCalled();
    });
    expect(screen.getByRole("button", { name: "Create Poll" })).toBeTruthy();
  });

  it("hides submit when unavailable", () => {
    render(
      <CreatePollForm
        available={false}
        running={false}
        starting={false}
        unavailableReason="unavailable"
        onStart={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Create Poll" })).toBeNull();
  });

  it("disables submit while a job is running", () => {
    render(<CreatePollForm available running starting={false} onStart={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Create Poll" })).toHaveProperty("disabled", true);
  });
});
