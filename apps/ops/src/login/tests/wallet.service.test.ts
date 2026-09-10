import { describe, expect, test, vi } from "vitest";

import { WalletService } from "../services/wallet.service.js";
import { operatorNonceMessage } from "../utils/nonceMessage.js";

const ADDRESS = "0xabc";
const CHAIN_ID = "0x534e5f5345504f4c4941";

describe("WalletService", () => {
  test("returns the address when Wallet.signMessage verification succeeds", async () => {
    const verify = vi.fn().mockResolvedValue(true);
    const walletService = new WalletService({ chainId: CHAIN_ID, verify });
    const signature = ["0x1", "0x2"];

    await expect(walletService.verify("nonce-1", JSON.stringify({ address: ADDRESS, signature }))).resolves.toBe(
      ADDRESS,
    );

    expect(verify).toHaveBeenCalledWith(operatorNonceMessage("nonce-1", CHAIN_ID), signature, ADDRESS);
  });

  test("rejects when verification fails", async () => {
    const walletService = new WalletService({
      chainId: CHAIN_ID,
      verify: (): Promise<boolean> => Promise.resolve(false),
    });

    await expect(
      walletService.verify("nonce-1", JSON.stringify({ address: ADDRESS, signature: ["0x1", "0x2"] })),
    ).rejects.toThrow(/invalid signature/u);
  });

  test("rejects a payload that is not a Starknet signature", async () => {
    const walletService = new WalletService({
      chainId: CHAIN_ID,
      verify: (): Promise<boolean> => Promise.resolve(true),
    });

    await expect(
      walletService.verify("nonce-1", JSON.stringify({ address: ADDRESS, nonce: "nonce-1" })),
    ).rejects.toThrow(/invalid signature/u);
  });

  test("rejects a payload that is not JSON", async () => {
    const walletService = new WalletService({
      chainId: CHAIN_ID,
      verify: (): Promise<boolean> => Promise.resolve(true),
    });

    await expect(walletService.verify("nonce-1", "not-json")).rejects.toThrow(/invalid signature/u);
  });
});
