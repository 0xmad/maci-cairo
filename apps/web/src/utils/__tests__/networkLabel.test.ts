import { describe, expect, it } from "vitest";

import { networkLabel } from "../networkLabel.js";

describe("networkLabel", () => {
  it("labels starknet_local and sepolia", () => {
    expect(networkLabel("starknet_local")).toBe("Starknet Local");
    expect(networkLabel("sepolia")).toBe("Sepolia");
  });
});
