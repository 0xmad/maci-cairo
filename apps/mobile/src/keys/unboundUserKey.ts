import { object, string } from "zod";

import { parseStoredJson } from "./parseStoredJson";

export interface UserPublicKey {
  x: string;
  y: string;
}

export interface UnboundUserKeyRecord {
  publicKey: UserPublicKey;
}

export interface SecureStorePort {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  deleteItem: (key: string) => Promise<void>;
}

export interface UserKeyCrypto {
  generatePrivateKey: () => string;
  publicKeyFromPrivate: (privateKey: string) => UserPublicKey;
}

/** Written at creation and deleted on clear. Callers must not read this entry except to backfill a missing public key. */
export const USER_PRIVATE_KEY_STORAGE_KEY = "maci.unbound.userPrivateKey";

export const USER_PUBLIC_KEY_STORAGE_KEY = "maci.userPublicKey";

export const storedUserPublicKeySchema = object({
  x: string().min(1),
  y: string().min(1),
});

const STORED_PUBLIC_KEY_INVALID = "Stored user public key is invalid.";

export const readStoredUserPublicKey = (raw: string): UserPublicKey =>
  parseStoredJson(raw, storedUserPublicKeySchema, STORED_PUBLIC_KEY_INVALID);

export interface UnboundUserKeyService {
  load: () => Promise<UnboundUserKeyRecord | null>;
  create: () => Promise<UnboundUserKeyRecord>;
  clear: () => Promise<void>;
}

export interface UnboundUserKeyServiceDeps {
  store: SecureStorePort;
  userKeyCrypto: UserKeyCrypto;
}

export const createUnboundUserKeyService = ({
  store,
  userKeyCrypto,
}: UnboundUserKeyServiceDeps): UnboundUserKeyService => {
  const load = async (): Promise<UnboundUserKeyRecord | null> => {
    const raw = await store.getItem(USER_PUBLIC_KEY_STORAGE_KEY);

    if (raw !== null) {
      return { publicKey: readStoredUserPublicKey(raw) };
    }

    const privateKey = await store.getItem(USER_PRIVATE_KEY_STORAGE_KEY);

    if (privateKey === null) {
      return null;
    }

    const publicKey = userKeyCrypto.publicKeyFromPrivate(privateKey);
    await store.setItem(USER_PUBLIC_KEY_STORAGE_KEY, JSON.stringify(publicKey));

    return { publicKey };
  };

  const create = async (): Promise<UnboundUserKeyRecord> => {
    const existing = await load();

    if (existing !== null) {
      return existing;
    }

    const privateKey = userKeyCrypto.generatePrivateKey();
    const publicKey = userKeyCrypto.publicKeyFromPrivate(privateKey);
    await store.setItem(USER_PRIVATE_KEY_STORAGE_KEY, privateKey);
    await store.setItem(USER_PUBLIC_KEY_STORAGE_KEY, JSON.stringify(publicKey));

    return { publicKey };
  };

  const clear = async (): Promise<void> => {
    await store.deleteItem(USER_PRIVATE_KEY_STORAGE_KEY);
    await store.deleteItem(USER_PUBLIC_KEY_STORAGE_KEY);
  };

  return { load, create, clear };
};

export {
  SERIALIZED_USER_PUBLIC_KEY_PREFIX,
  formatUserPublicKeyPreview,
  serializeUserPublicKey,
} from "./serializeUserPublicKey";
