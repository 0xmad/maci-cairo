import { type infer as ZodInfer, object, string } from "zod";

import { parseStoredJson } from "./parseStoredJson";
import { storedUserPublicKeySchema, type SecureStorePort, type UserPublicKey } from "./unboundUserKey";

export const BOUND_USER_KEY_STORAGE_KEY = "maci.bound.userKey";

export interface BoundUserKeyRecord {
  maciAddress: string;
  publicKey: UserPublicKey;
}

const storedBoundUserKeySchema = object({
  maciAddress: string().min(1),
  publicKey: storedUserPublicKeySchema,
});

type StoredBoundUserKey = ZodInfer<typeof storedBoundUserKeySchema>;

const STORED_BINDING_INVALID = "Stored MACI binding is invalid.";

export interface MaciBindingService {
  load: () => Promise<BoundUserKeyRecord | null>;
  hasStoredBinding: () => Promise<boolean>;
  bind: () => Promise<BoundUserKeyRecord>;
  clear: () => Promise<void>;
}

export interface MaciBindingServiceDeps {
  store: SecureStorePort;
  loadPublicKey: () => Promise<UserPublicKey | null>;
  maciAddress: string | null;
}

export const createMaciBindingService = ({
  store,
  loadPublicKey,
  maciAddress,
}: MaciBindingServiceDeps): MaciBindingService => {
  const readStored = async (): Promise<StoredBoundUserKey | null> => {
    const raw = await store.getItem(BOUND_USER_KEY_STORAGE_KEY);

    if (raw === null) {
      return null;
    }

    return parseStoredJson(raw, storedBoundUserKeySchema, STORED_BINDING_INVALID);
  };

  const load = async (): Promise<BoundUserKeyRecord | null> => {
    if (maciAddress === null) {
      return null;
    }

    const stored = await readStored();

    if (stored?.maciAddress !== maciAddress) {
      return null;
    }

    return stored;
  };

  const hasStoredBinding = async (): Promise<boolean> => {
    const stored = await readStored();

    return stored !== null;
  };

  const bind = async (): Promise<BoundUserKeyRecord> => {
    if (maciAddress === null) {
      throw new Error("No MACI is configured.");
    }

    const stored = await readStored();

    if (stored !== null) {
      if (stored.maciAddress !== maciAddress) {
        throw new Error("A user private key is already bound to another MACI.");
      }

      return stored;
    }

    const publicKey = await loadPublicKey();

    if (publicKey === null) {
      throw new Error("No unbound user key.");
    }

    const next: StoredBoundUserKey = { maciAddress, publicKey };
    await store.setItem(BOUND_USER_KEY_STORAGE_KEY, JSON.stringify(next));

    return next;
  };

  const clear = async (): Promise<void> => {
    await store.deleteItem(BOUND_USER_KEY_STORAGE_KEY);
  };

  return { load, hasStoredBinding, bind, clear };
};
