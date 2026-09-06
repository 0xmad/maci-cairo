import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NetworkSwitcher } from "..";
import { NetworkProvider } from "../../../providers/Network";

const renderSwitcher = (): ReturnType<typeof render> =>
  render(
    <NetworkProvider>
      <NetworkSwitcher />
    </NetworkProvider>,
  );

const networkSelect = (): HTMLSelectElement => screen.getByRole("combobox", { name: "Network" });

describe("NetworkSwitcher", () => {
  it("defaults to local with the local RPC in the title", () => {
    renderSwitcher();

    const select = networkSelect();

    expect(select.value).toBe("local");
    expect(select.title).toBe("http://127.0.0.1:5050/");
    expect(screen.getByRole("option", { name: "Local" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Sepolia" })).toBeTruthy();
  });

  it("switches to Sepolia and updates the RPC title", () => {
    renderSwitcher();

    const select = networkSelect();

    fireEvent.change(select, { target: { value: "sepolia" } });

    expect(select.value).toBe("sepolia");
    expect(select.title).toBe("https://starknet-sepolia.public.blastapi.io");
  });

  it("ignores a value that is not an app network", () => {
    renderSwitcher();

    const select = networkSelect();

    fireEvent.change(select, { target: { value: "mainnet" } });

    expect(select.value).toBe("local");
    expect(select.title).toBe("http://127.0.0.1:5050/");
  });
});
