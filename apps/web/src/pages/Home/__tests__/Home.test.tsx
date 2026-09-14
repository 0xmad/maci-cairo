import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HomePage } from "..";
import { App } from "../../../App";
import { useMaciInstances } from "../useMaciInstances";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), dismiss: vi.fn() },
  Toaster: (): null => null,
}));

vi.mock("../useMaciInstances", () => ({
  MACI_LIST_PAGE_SIZE: 10,
  useMaciInstances: vi.fn(),
}));

const useMaciInstancesMock = vi.mocked(useMaciInstances);

const nextPage = vi.fn();
const prevPage = vi.fn();

const LIST_ITEM = {
  address: "0x064b48806902a367c8598f4f95c305e8c1a1acba5f082d294a43793113115691",
  network: "starknet_local" as const,
  createdAtMs: Date.UTC(2026, 8, 13, 23, 40, 0),
};

describe("Home page", () => {
  beforeEach(() => {
    nextPage.mockReset();
    prevPage.mockReset();
    useMaciInstancesMock.mockReturnValue({
      signedIn: false,
      items: [],
      page: 1,
      pageCount: 0,
      nextPage,
      prevPage,
    });
  });

  it("renders the Home heading and a Connect control", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "MACI instances" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Connect" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Start MACI stand-up" })).toBeNull();
  });

  it("asks an unsigned-in visitor to sign in as Operator to list instances", () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Sign in as Operator to list MACI instances.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Start MACI stand-up" })).toBeNull();
    expect(screen.queryByLabelText("Circuit profile")).toBeNull();
    expect(screen.queryByText(/declare and deploy the contract graph/iu)).toBeNull();
    expect(screen.queryByText(/Checker/iu)).toBeNull();
    expect(screen.queryByText(/Enforcer/iu)).toBeNull();
  });

  it("shows an empty list for a signed-in Operator with no MACI instances", () => {
    useMaciInstancesMock.mockReturnValue({
      signedIn: true,
      items: [],
      page: 1,
      pageCount: 0,
      nextPage,
      prevPage,
    });

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(screen.getByText("No MACI instances yet.")).toBeTruthy();
    expect(screen.queryByText("Address")).toBeNull();
  });

  it("lists truncated addresses and opens a row", () => {
    useMaciInstancesMock.mockReturnValue({
      signedIn: true,
      items: [LIST_ITEM],
      page: 1,
      pageCount: 2,
      nextPage,
      prevPage,
    });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<HomePage />} path="/" />

          <Route element={<p>maci-detail</p>} path="/maci/:address" />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.getByText("0x064b…5691")).toBeTruthy();
    expect(screen.getByText("0x064b48806902a367c8598f4f95c305e8c1a1acba5f082d294a43793113115691")).toBeTruthy();
    expect(screen.getByText("Starknet Local")).toBeTruthy();
    expect(screen.getByText("Created at")).toBeTruthy();
    expect(screen.getByText("2026-09-13 23:40 UTC")).toBeTruthy();
    expect(screen.getByText("Page 1 of 2")).toBeTruthy();

    fireEvent.click(screen.getByText("0x064b…5691"));

    expect(screen.getByText("maci-detail")).toBeTruthy();
  });

  it("opens a row with Enter", () => {
    useMaciInstancesMock.mockReturnValue({
      signedIn: true,
      items: [LIST_ITEM],
      page: 1,
      pageCount: 2,
      nextPage,
      prevPage,
    });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<HomePage />} path="/" />

          <Route element={<p>maci-detail</p>} path="/maci/:address" />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.keyDown(screen.getByText("0x064b…5691"), { key: "Enter" });

    expect(screen.getByText("maci-detail")).toBeTruthy();
  });

  it("does not open a row for a non-Enter key", () => {
    useMaciInstancesMock.mockReturnValue({
      signedIn: true,
      items: [{ ...LIST_ITEM, network: "sepolia" }],
      page: 1,
      pageCount: 1,
      error: "MACI list failed",
      nextPage,
      prevPage,
    });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<HomePage />} path="/" />

          <Route element={<p>maci-detail</p>} path="/maci/:address" />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Sepolia")).toBeTruthy();
    expect(screen.getByText("MACI list failed")).toBeTruthy();

    fireEvent.keyDown(screen.getByText("0x064b…5691"), { key: " " });

    expect(screen.queryByText("maci-detail")).toBeNull();
  });

  it("keeps a full page of rows and pagination when a page is short", () => {
    useMaciInstancesMock.mockReturnValue({
      signedIn: true,
      items: [LIST_ITEM],
      page: 1,
      pageCount: 1,
      nextPage,
      prevPage,
    });

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(screen.getAllByRole("row", { hidden: true })).toHaveLength(12);
    expect(screen.getByText("Page 1 of 1")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Previous" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Next" })).toHaveProperty("disabled", true);
  });
});
