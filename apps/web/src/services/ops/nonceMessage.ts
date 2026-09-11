import { type TypedData } from "starknet";

/** SNIP-12 payload for `wallet_signTypedData`. Keep in sync with `apps/ops/src/login/utils/nonceMessage.ts`. */
export function operatorNonceMessage(nonce: string, chainId: string): TypedData {
  return {
    types: {
      StarknetDomain: [
        { name: "name", type: "shortstring" },
        { name: "version", type: "shortstring" },
        { name: "chainId", type: "shortstring" },
        { name: "revision", type: "shortstring" },
      ],
      Message: [{ name: "nonce", type: "felt" }],
    },
    primaryType: "Message",
    domain: {
      name: "MACI Ops",
      version: "1",
      chainId,
      revision: "1",
    },
    message: { nonce },
  };
}
