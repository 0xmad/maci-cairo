import { describe, expect, test } from "vitest";

import { type ChainEvent, type PaidCall, type PaidInvocation, type RelayerAccount } from "../../account/types.js";
import { type SignupBody } from "../dto/signup.dto.js";
import { PublicKeyAlreadySignedUp, SignupService } from "../signup.service.js";
import { SIGNUP_EVENT_SELECTOR } from "../utils/signUpCall.js";

const SIGNUP: SignupBody = {
  userPublicKey: { x: "1", y: "2" },
  evidence: "",
  maci: "0xabc",
};

function signupEvent(limbs: string[]): ChainEvent {
  return {
    fromAddress: SIGNUP.maci,
    keys: [SIGNUP_EVENT_SELECTOR, ...limbs],
    data: [],
  };
}

function accountReturning(invocation: Partial<PaidInvocation>): RelayerAccount {
  return {
    address: "0x11",
    invokeAndPay(call: PaidCall): Promise<PaidInvocation> {
      return Promise.resolve({
        transactionHash: "0x71",
        sender: "0x11",
        feeAmount: "0x64",
        paymasterData: [],
        events: [signupEvent(call.calldata.slice(0, 4))],
        ...invocation,
      });
    },
  };
}

describe("SignupService", () => {
  test("rejects a receipt whose sender is not the Relayer account", async () => {
    await expect(new SignupService(accountReturning({ sender: "0x99" })).submit(SIGNUP)).rejects.toThrow(
      /Relayer account must call sign_up and pay the fee/u,
    );
  });

  test("rejects a transaction that carries paymaster data", async () => {
    await expect(new SignupService(accountReturning({ paymasterData: ["0x9"] })).submit(SIGNUP)).rejects.toThrow(
      /Relayer account must call sign_up and pay the fee/u,
    );
  });

  test("rejects a receipt with no fee", async () => {
    await expect(new SignupService(accountReturning({ feeAmount: "" })).submit(SIGNUP)).rejects.toThrow(
      /Relayer account must call sign_up and pay the fee/u,
    );
    await expect(new SignupService(accountReturning({ feeAmount: "0" })).submit(SIGNUP)).rejects.toThrow(
      /Relayer account must call sign_up and pay the fee/u,
    );
    await expect(new SignupService(accountReturning({ feeAmount: "0x0" })).submit(SIGNUP)).rejects.toThrow(
      /Relayer account must call sign_up and pay the fee/u,
    );
    await expect(new SignupService(accountReturning({ feeAmount: "nope" })).submit(SIGNUP)).rejects.toThrow(
      /Relayer account must call sign_up and pay the fee/u,
    );
  });

  test("rejects a receipt that has no Signup event for that user public key", async () => {
    const x = "1606938044258990275541962092341162602522202993782792835301379";

    await expect(
      new SignupService(accountReturning({ events: [signupEvent(["3", "2"])] })).submit({
        ...SIGNUP,
        userPublicKey: { x, y: "2" },
      }),
    ).rejects.toThrow(/Signup event is not on chain/u);
  });

  test("rejects a reverted sign_up", async () => {
    await expect(
      new SignupService(accountReturning({ revertReason: "execution failed" })).submit(SIGNUP),
    ).rejects.toThrow(/execution failed/u);
  });

  test("rejects a user public key the chain already registered", async () => {
    await expect(
      new SignupService(accountReturning({ revertReason: "Public key already signed up", events: [] })).submit(SIGNUP),
    ).rejects.toBeInstanceOf(PublicKeyAlreadySignedUp);
  });
});
