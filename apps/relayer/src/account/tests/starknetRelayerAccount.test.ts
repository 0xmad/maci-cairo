import { describe, expect, test } from "vitest";

import {
  type AccountReceipt,
  type AccountTransaction,
  starknetRelayerAccount,
  type StarknetPaidAccount,
} from "../starknetRelayerAccount.js";
import { type PaidCall } from "../types.js";

const CALL: PaidCall = {
  contractAddress: "0xabc",
  entrypoint: "sign_up",
  calldata: ["1", "0", "2", "0", "0", "0", "0"],
};

function includedReceipt(executionStatus: "SUCCEEDED" | "REVERTED", revertReason?: string): AccountReceipt {
  return {
    statusReceipt: executionStatus,
    value: {
      execution_status: executionStatus,
      actual_fee: { amount: "0x64" },
      events: [{ from_address: "0xabc", keys: ["1", "0", "2", "0"], data: ["3"] }],
      revert_reason: revertReason,
    },
  };
}

function errorReceipt(): AccountReceipt {
  return { statusReceipt: "ERROR" };
}

function invokeTransaction(sender: string, paymasterData: string[]): AccountTransaction {
  return {
    transaction_hash: "0x71",
    sender_address: sender,
    paymaster_data: paymasterData,
  };
}

/** Paymaster data that is not a list of felts. */
function invokeWithNonStringPaymaster(): AccountTransaction {
  return {
    transaction_hash: "0x71",
    sender_address: "0x11",
    paymaster_data: [1],
  };
}

/** A transaction that does not name the Relayer account. */
function transactionWithoutSender(): AccountTransaction {
  return { transaction_hash: "0x71" };
}

function paidAccount(options: {
  sender: string;
  paymasterData: string[];
  executionStatus: "SUCCEEDED" | "REVERTED";
  revertReason?: string;
  receipt?: AccountReceipt;
  transaction?: AccountTransaction;
}): { account: StarknetPaidAccount; executeArgs: unknown[][] } {
  const executeArgs: unknown[][] = [];
  const account: StarknetPaidAccount = {
    address: "0x11",
    execute: (...args: unknown[]) => {
      executeArgs.push(args);

      return Promise.resolve({ transaction_hash: "0x71" });
    },
    provider: {
      waitForTransaction: () =>
        Promise.resolve(options.receipt ?? includedReceipt(options.executionStatus, options.revertReason)),
      getTransaction: () =>
        Promise.resolve(options.transaction ?? invokeTransaction(options.sender, options.paymasterData)),
    },
  };

  return { account, executeArgs };
}

describe("starknetRelayerAccount", () => {
  test("submits sign_up with no paymaster and reads the sender, fee, and Signup event", async () => {
    const { account, executeArgs } = paidAccount({
      sender: "0x22",
      paymasterData: [],
      executionStatus: "SUCCEEDED",
    });

    await expect(starknetRelayerAccount(account).invokeAndPay(CALL)).resolves.toEqual({
      transactionHash: "0x71",
      sender: "0x22",
      feeAmount: "0x64",
      paymasterData: [],
      events: [{ fromAddress: "0xabc", keys: ["1", "0", "2", "0"], data: ["3"] }],
      revertReason: undefined,
    });
    expect(executeArgs).toEqual([[CALL]]);
  });

  test("keeps a reverted reason and any paymaster data from the included transaction", async () => {
    const { account } = paidAccount({
      sender: "0x11",
      paymasterData: ["0x9"],
      executionStatus: "REVERTED",
      revertReason: "Public key already signed up",
    });

    await expect(starknetRelayerAccount(account).invokeAndPay(CALL)).resolves.toMatchObject({
      sender: "0x11",
      paymasterData: ["0x9"],
      revertReason: "Public key already signed up",
      feeAmount: "0x64",
    });
  });

  test("rejects a receipt that was not accepted", async () => {
    const { account } = paidAccount({
      sender: "0x11",
      paymasterData: [],
      executionStatus: "SUCCEEDED",
      receipt: errorReceipt(),
    });

    await expect(starknetRelayerAccount(account).invokeAndPay(CALL)).rejects.toThrow(
      /Signup transaction was not accepted/u,
    );
  });

  test("rejects paymaster data that is not a list of felts", async () => {
    const { account } = paidAccount({
      sender: "0x11",
      paymasterData: [],
      executionStatus: "SUCCEEDED",
      transaction: invokeWithNonStringPaymaster(),
    });

    await expect(starknetRelayerAccount(account).invokeAndPay(CALL)).rejects.toThrow(
      /sign_up transaction is missing the Relayer account/u,
    );
  });

  test("rejects a transaction that does not name the Relayer account", async () => {
    const { account } = paidAccount({
      sender: "0x11",
      paymasterData: [],
      executionStatus: "SUCCEEDED",
      transaction: transactionWithoutSender(),
    });

    await expect(starknetRelayerAccount(account).invokeAndPay(CALL)).rejects.toThrow(
      /sign_up transaction is missing the Relayer account/u,
    );
  });
});
