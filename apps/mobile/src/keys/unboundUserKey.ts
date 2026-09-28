export interface UserPublicKey {
  x: string;
  y: string;
}

export interface UnboundUserKeyRecord {
  privateKey: string;
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

export const UNBOUND_USER_PRIVATE_KEY_STORAGE_KEY = "maci.unbound.userPrivateKey";

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
    const privateKey = await store.getItem(UNBOUND_USER_PRIVATE_KEY_STORAGE_KEY);

    if (privateKey === null) {
      return null;
    }

    return {
      privateKey,
      publicKey: userKeyCrypto.publicKeyFromPrivate(privateKey),
    };
  };

  const create = async (): Promise<UnboundUserKeyRecord> => {
    const existing = await load();

    if (existing !== null) {
      return existing;
    }

    const privateKey = userKeyCrypto.generatePrivateKey();
    await store.setItem(UNBOUND_USER_PRIVATE_KEY_STORAGE_KEY, privateKey);

    return {
      privateKey,
      publicKey: userKeyCrypto.publicKeyFromPrivate(privateKey),
    };
  };

  const clear = async (): Promise<void> => {
    await store.deleteItem(UNBOUND_USER_PRIVATE_KEY_STORAGE_KEY);
  };

  return { load, create, clear };
};

export {
  SERIALIZED_USER_PUBLIC_KEY_PREFIX,
  formatUserPublicKeyPreview,
  serializeUserPublicKey,
} from "./serializeUserPublicKey";
