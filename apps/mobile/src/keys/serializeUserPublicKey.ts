import { packPoint } from "@zk-kit/baby-jubjub";

import { type UserPublicKey } from "./unboundUserKey";

/** Matches MACI `PublicKey.serialize` (`macipk.` + packed hex). */
export const SERIALIZED_USER_PUBLIC_KEY_PREFIX = "macipk.";

export const serializeUserPublicKey = (publicKey: UserPublicKey): string => {
  const packed = packPoint([BigInt(publicKey.x), BigInt(publicKey.y)]).toString(16);

  if (packed.length % 2 !== 0) {
    return `${SERIALIZED_USER_PUBLIC_KEY_PREFIX}0${packed}`;
  }

  return `${SERIALIZED_USER_PUBLIC_KEY_PREFIX}${packed}`;
};

export const formatUserPublicKeyPreview = (publicKey: UserPublicKey): string => {
  const serialized = serializeUserPublicKey(publicKey);

  if (serialized.length <= 12) {
    return serialized;
  }

  return `${serialized.slice(0, 6)}…${serialized.slice(-4)}`;
};
