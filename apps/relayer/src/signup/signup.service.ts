import { type RelayerAccount } from "../account/types.js";

import { type SignupBody } from "./dto/signup.dto.js";
import { relayerPaidSchema } from "./signup.schema.js";
import { signUpCall, signupEventMatches } from "./utils/signUpCall.js";

export class PublicKeyAlreadySignedUp extends Error {
  constructor() {
    super("Public key already signed up");
    this.name = "PublicKeyAlreadySignedUp";
  }
}

/** Submits Signup and returns once the Signup event is in the included transaction. */
export class SignupService {
  readonly #account: RelayerAccount;

  constructor(account: RelayerAccount) {
    this.#account = account;
  }

  async submit(signup: SignupBody): Promise<{ transactionHash: string }> {
    const paid = await this.#account.invokeAndPay(signUpCall(signup));

    if (!relayerPaidSchema(this.#account.address).safeParse(paid).success) {
      throw new Error("Relayer account must call sign_up and pay the fee");
    }

    if (paid.revertReason?.includes("Public key already signed up")) {
      throw new PublicKeyAlreadySignedUp();
    }

    if (paid.revertReason !== undefined) {
      throw new Error(paid.revertReason);
    }

    if (!signupEventMatches(paid.events, signup)) {
      throw new Error("Signup event is not on chain");
    }

    return { transactionHash: paid.transactionHash };
  }
}
