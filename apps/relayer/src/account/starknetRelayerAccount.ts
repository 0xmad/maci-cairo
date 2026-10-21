import { type ChainEvent, type PaidCall, type PaidInvocation, type RelayerAccount } from "./types.js";

interface IncludedReceipt {
  statusReceipt: "SUCCEEDED" | "REVERTED";
  value: {
    execution_status: "SUCCEEDED" | "REVERTED";
    actual_fee: { amount: string };
    events: readonly {
      from_address: string;
      keys: readonly string[];
      data: readonly string[];
    }[];
    revert_reason?: string;
  };
}

interface RejectedReceipt {
  statusReceipt: "ERROR";
}

/** Receipt fields the Relayer reads from `waitForTransaction`. */
export type AccountReceipt = IncludedReceipt | RejectedReceipt;

/** Transaction fields the Relayer reads from `getTransaction`. */
export interface AccountTransaction {
  transaction_hash: string;
  sender_address?: unknown;
  paymaster_data?: unknown;
}

/** The subset of starknet.js `Account` this Relayer uses to submit and pay. */
export interface StarknetPaidAccount {
  address: string;
  execute: (call: PaidCall) => Promise<{ transaction_hash: string }>;
  provider: {
    waitForTransaction: (hash: string) => Promise<AccountReceipt>;
    getTransaction: (hash: string) => Promise<AccountTransaction>;
  };
}

function readReceipt(receipt: AccountReceipt): {
  executionStatus: "SUCCEEDED" | "REVERTED";
  feeAmount: string;
  events: ChainEvent[];
  revertReason?: string;
} {
  if (receipt.statusReceipt === "ERROR") {
    throw new Error("Signup transaction was not accepted");
  }

  return {
    executionStatus: receipt.value.execution_status,
    feeAmount: receipt.value.actual_fee.amount,
    events: receipt.value.events.map((event) => ({
      fromAddress: event.from_address,
      keys: [...event.keys],
      data: [...event.data],
    })),
    revertReason: receipt.statusReceipt === "REVERTED" ? receipt.value.revert_reason : undefined,
  };
}

function readInvoke(transaction: AccountTransaction): { sender: string; paymasterData: string[] } {
  if (
    !("sender_address" in transaction) ||
    typeof transaction.sender_address !== "string" ||
    !("paymaster_data" in transaction) ||
    !Array.isArray(transaction.paymaster_data)
  ) {
    throw new Error("sign_up transaction is missing the Relayer account");
  }

  const paymasterData = transaction.paymaster_data.map((felt: unknown) => {
    if (typeof felt !== "string") {
      throw new Error("sign_up transaction is missing the Relayer account");
    }

    return felt;
  });

  return {
    sender: transaction.sender_address,
    paymasterData,
  };
}

/** Reads the included transaction. The Relayer account is the sender; it paid `actual_fee`. */
export function starknetRelayerAccount(account: StarknetPaidAccount): RelayerAccount {
  return {
    address: account.address,
    async invokeAndPay(call: PaidCall): Promise<PaidInvocation> {
      const invoked = await account.execute(call);
      const receipt = readReceipt(await account.provider.waitForTransaction(invoked.transaction_hash));
      const transaction = readInvoke(await account.provider.getTransaction(invoked.transaction_hash));

      return {
        transactionHash: invoked.transaction_hash,
        sender: transaction.sender,
        feeAmount: receipt.feeAmount,
        paymasterData: transaction.paymasterData,
        events: receipt.events,
        revertReason: receipt.executionStatus === "REVERTED" ? receipt.revertReason : undefined,
      };
    },
  };
}
