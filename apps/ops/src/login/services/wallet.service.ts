import { type Signature, type TypedData } from "starknet";
import { array, NEVER, strictObject, string } from "zod";

import { operatorNonceMessage } from "../utils/nonceMessage.js";

export interface WalletServiceDeps {
  chainId: string;
  verify: (message: TypedData, signature: Signature, address: string) => Promise<boolean>;
}

const walletProofSchema = string()
  .transform((raw, ctx) => {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      ctx.addIssue({ code: "custom", message: "invalid signature" });

      return NEVER;
    }
  })
  .pipe(
    strictObject({
      address: string().min(1),
      signature: array(string()).min(1),
    }),
  );

export interface WalletVerifier {
  verify: (nonce: string, signature: string) => Promise<string>;
}

/**
 * Verifies a Starknet `signMessage` signature over the Operator nonce and returns
 * the signed account address.
 */
export class WalletService implements WalletVerifier {
  readonly #deps: WalletServiceDeps;

  constructor(deps: WalletServiceDeps) {
    this.#deps = deps;
  }

  async verify(nonce: string, signature: string): Promise<string> {
    const parsed = walletProofSchema.safeParse(signature);

    if (!parsed.success) {
      throw new Error("invalid signature");
    }

    const message = operatorNonceMessage(nonce, this.#deps.chainId);
    const valid = await this.#deps.verify(message, parsed.data.signature, parsed.data.address);

    if (!valid) {
      throw new Error("invalid signature");
    }

    return parsed.data.address;
  }
}
