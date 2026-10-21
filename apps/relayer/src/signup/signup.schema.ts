import { array, object, string, type ZodType } from "zod";

import { sameInteger } from "./utils/signUpCall.js";

function positiveFee(feeAmount: string): boolean {
  try {
    return BigInt(feeAmount) > 0n;
  } catch {
    return false;
  }
}

/** The Relayer account is the sender, the paymaster data is empty, and the fee is positive. */
export function relayerPaidSchema(accountAddress: string): ZodType<{
  sender: string;
  paymasterData: string[];
  feeAmount: string;
}> {
  return object({
    sender: string().refine((sender) => sameInteger(sender, accountAddress)),
    paymasterData: array(string()).length(0),
    feeAmount: string().refine(positiveFee),
  });
}
