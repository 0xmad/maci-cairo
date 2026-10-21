import { type ChainEvent, type PaidCall } from "../../account/types.js";
import { type SignupBody } from "../dto/signup.dto.js";

const U128_BOUND = 2n ** 128n;

/** Starknet selector of the MACI `Signup` event. */
export const SIGNUP_EVENT_SELECTOR = "0x1f41d0b947c93b00c783e9529e692ebc5e0a30189057303fbe18be5e5761d1a";

function decimalInteger(value: string): string {
  return BigInt(value).toString(10);
}

function splitU256(value: bigint): [string, string] {
  return [(value % U128_BOUND).toString(10), (value / U128_BOUND).toString(10)];
}

/** Low and high limbs of the user public key, in `sign_up` calldata order. */
export function userPublicKeyLimbs(userPublicKey: { x: string; y: string }): [string, string, string, string] {
  const [xLow, xHigh] = splitU256(BigInt(userPublicKey.x));
  const [yLow, yHigh] = splitU256(BigInt(userPublicKey.y));

  return [xLow, xHigh, yLow, yHigh];
}

/** Calldata for `sign_up(public_key, empty Evidence)`. */
export function signUpCall(signup: SignupBody): PaidCall {
  return {
    contractAddress: signup.maci,
    entrypoint: "sign_up",
    calldata: [...userPublicKeyLimbs(signup.userPublicKey), "0", "0", "0"],
  };
}

function containsLimbSequence(keys: string[], limbs: string[]): boolean {
  const normalized = keys.map((key) => decimalInteger(key));

  return normalized.some((_, index) => limbs.every((limb, offset) => normalized[index + offset] === limb));
}

/** True when both strings are the same integer, including hex and decimal forms. */
export function sameInteger(left: string, right: string): boolean {
  return BigInt(left) === BigInt(right);
}

/** True when the MACI emitted `Signup` for this user public key. */
export function signupEventMatches(events: ChainEvent[], signup: SignupBody): boolean {
  const limbs = userPublicKeyLimbs(signup.userPublicKey);

  return events.some((event) => {
    const selector = event.keys[0];

    return (
      sameInteger(event.fromAddress, signup.maci) &&
      event.keys.length > 0 &&
      sameInteger(selector, SIGNUP_EVENT_SELECTOR) &&
      containsLimbSequence(event.keys.slice(1), limbs)
    );
  });
}
