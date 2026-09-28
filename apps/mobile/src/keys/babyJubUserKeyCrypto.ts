import { Base8, mulPointEscalar, subOrder } from "@zk-kit/baby-jubjub";
import { getRandomBytes } from "expo-crypto";

import { type UserKeyCrypto, type UserPublicKey } from "./unboundUserKey";

const privateKeyFromBytes = (bytes: Uint8Array): bigint => {
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const reduced = BigInt(`0x${hex}`) % subOrder;

  return reduced === 0n ? 1n : reduced;
};

export const babyJubUserKeyCrypto: UserKeyCrypto = {
  generatePrivateKey: (): string => privateKeyFromBytes(getRandomBytes(32)).toString(),
  publicKeyFromPrivate: (privateKey: string): UserPublicKey => {
    const [x, y] = mulPointEscalar(Base8, BigInt(privateKey));

    return { x: x.toString(), y: y.toString() };
  },
};
