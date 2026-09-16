import { unpackPoint } from "@zk-kit/baby-jubjub";
import { NEVER, string } from "zod";

const INVALID_POLL_PUBLIC_KEY = "Invalid Poll public key";

/** Packed BabyJub Poll public key as a decimal or `0x` bigint string. */
export const pollPublicKeySchema = string({ error: INVALID_POLL_PUBLIC_KEY })
  .trim()
  .regex(/^(?:0x[0-9a-fA-F]+|[0-9]+)$/u, { error: INVALID_POLL_PUBLIC_KEY })
  .transform((value, ctx): [string, string] => {
    const point = unpackPoint(BigInt(value));

    if (point === null) {
      ctx.addIssue({ code: "custom", message: INVALID_POLL_PUBLIC_KEY });

      return NEVER;
    }

    return [point[0].toString(), point[1].toString()];
  });
