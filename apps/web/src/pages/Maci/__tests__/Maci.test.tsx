import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MaciPage } from "..";
import { useMaciInstance } from "../useMaciInstance";

vi.mock("../useMaciInstance", () => ({
  useMaciInstance: vi.fn(),
}));

const useMaciInstanceMock = vi.mocked(useMaciInstance);

const INSTANCE = {
  leanImt: "0x1",
  checker: "0x2",
  enforcer: "0x3",
  assigner: "0x4",
  pollClassHash: "0x5",
  pollFactoryClassHash: "0x6",
  maci: "0x7",
  pollFactory: "0x8",
  coordinator: "0x9",
  deployer: "0xa",
  network: "starknet_local" as const,
  circuitProfile: "small",
  policy: "Free for all",
  voteBalanceAssigner: "Constant vote balance",
};

describe("MaciPage", () => {
  beforeEach(() => {
    useMaciInstanceMock.mockReturnValue({
      address: "0x7",
      signedIn: false,
    });
  });

  it("asks an unsigned-in visitor to sign in as Operator", () => {
    render(<MaciPage />);

    expect(screen.getByRole("heading", { name: "MACI" })).toBeTruthy();
    expect(screen.getByText("Sign in as Operator to view this MACI.")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Create Poll" })).toBeNull();
  });

  it("shows Operator-facing stand-up choices and related contracts without Checker or Enforcer", () => {
    useMaciInstanceMock.mockReturnValue({
      address: "0x7",
      signedIn: true,
      instance: INSTANCE,
    });

    render(<MaciPage />);

    expect(screen.getByText("LeanIMT")).toBeTruthy();
    expect(screen.getByText("0x1")).toBeTruthy();
    expect(screen.getByText("Circuit profile")).toBeTruthy();
    expect(screen.getByText("small")).toBeTruthy();
    expect(screen.getByText("Policy")).toBeTruthy();
    expect(screen.getByText("Free for all")).toBeTruthy();
    expect(screen.getByText("Vote balance assigner")).toBeTruthy();
    expect(screen.getByText("Constant vote balance")).toBeTruthy();
    expect(screen.getByText("Deployer")).toBeTruthy();
    expect(screen.getByText("0xa")).toBeTruthy();
    expect(screen.getByText("Starknet Local")).toBeTruthy();
    expect(screen.queryByText("Checker")).toBeNull();
    expect(screen.queryByText("Enforcer")).toBeNull();
    expect(screen.queryByText("0x2")).toBeNull();
    expect(screen.queryByText("0x3")).toBeNull();
    expect(screen.queryByRole("button", { name: "Create Poll" })).toBeNull();
    expect(screen.queryByText("Create Poll is not wired and sends no transaction.")).toBeNull();
  });

  it("labels a sepolia instance", () => {
    useMaciInstanceMock.mockReturnValue({
      address: "0x7",
      signedIn: true,
      instance: { ...INSTANCE, network: "sepolia" },
    });

    render(<MaciPage />);

    expect(screen.getByText("Sepolia")).toBeTruthy();
  });

  it("shows a load error", () => {
    useMaciInstanceMock.mockReturnValue({
      address: "0x7",
      signedIn: true,
      error: "maci not found",
    });

    render(<MaciPage />);

    expect(screen.getByText("maci not found")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Create Poll" })).toBeNull();
  });
});
