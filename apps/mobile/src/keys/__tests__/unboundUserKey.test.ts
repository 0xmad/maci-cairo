import { createMemorySecureStore } from "../../test/memorySecureStore";
import { fixedPublicKey } from "../testFixtures";
import {
  createUnboundUserKeyService,
  USER_PRIVATE_KEY_STORAGE_KEY,
  USER_PUBLIC_KEY_STORAGE_KEY,
  type SecureStorePort,
  type UserKeyCrypto,
  type UserPublicKey,
} from "../unboundUserKey";

const createFixedCrypto = (privateKey = "42"): UserKeyCrypto => ({
  generatePrivateKey: (): string => privateKey,
  publicKeyFromPrivate: (key: string): UserPublicKey => {
    if (key !== privateKey) {
      throw new Error(`unexpected private key: ${key}`);
    }

    return fixedPublicKey;
  },
});

describe("unbound user key service", () => {
  it("stores the private key and returns only the public key", async () => {
    const reads: string[] = [];
    const writes: [string, string][] = [];
    const values = new Map<string, string>();
    const store: SecureStorePort = {
      getItem: (key: string): Promise<string | null> => {
        reads.push(key);

        return Promise.resolve(values.get(key) ?? null);
      },
      setItem: (key: string, value: string): Promise<void> => {
        writes.push([key, value]);
        values.set(key, value);

        return Promise.resolve();
      },
      deleteItem: (key: string): Promise<void> => {
        values.delete(key);

        return Promise.resolve();
      },
    };
    const service = createUnboundUserKeyService({
      store,
      userKeyCrypto: createFixedCrypto("99"),
    });

    const record = await service.create();

    expect(record).toEqual({ publicKey: fixedPublicKey });
    expect(writes).toEqual([
      [USER_PRIVATE_KEY_STORAGE_KEY, "99"],
      [USER_PUBLIC_KEY_STORAGE_KEY, JSON.stringify(fixedPublicKey)],
    ]);
    reads.length = 0;

    expect(await service.load()).toEqual(record);
    expect(reads).not.toContain(USER_PRIVATE_KEY_STORAGE_KEY);
  });

  it("returns the existing unbound key without generating again", async () => {
    let generateCount = 0;
    const userKeyCrypto: UserKeyCrypto = {
      generatePrivateKey: (): string => {
        generateCount += 1;

        return "7";
      },
      publicKeyFromPrivate: (): UserPublicKey => fixedPublicKey,
    };
    const service = createUnboundUserKeyService({
      store: createMemorySecureStore(),
      userKeyCrypto,
    });

    const first = await service.create();
    const second = await service.create();

    expect(first).toEqual(second);
    expect(generateCount).toBe(1);
  });

  it("loads null when no unbound key is stored", async () => {
    const service = createUnboundUserKeyService({
      store: createMemorySecureStore(),
      userKeyCrypto: createFixedCrypto(),
    });

    expect(await service.load()).toBeNull();
  });

  it("clears a stored unbound key", async () => {
    const service = createUnboundUserKeyService({
      store: createMemorySecureStore(),
      userKeyCrypto: createFixedCrypto("99"),
    });

    await service.create();
    await service.clear();

    expect(await service.load()).toBeNull();
  });

  it("rejects a stored public key that is not JSON", async () => {
    const store = createMemorySecureStore();
    const service = createUnboundUserKeyService({
      store,
      userKeyCrypto: createFixedCrypto(),
    });
    await store.setItem(USER_PUBLIC_KEY_STORAGE_KEY, "{");

    await expect(service.load()).rejects.toThrow("Stored user public key is invalid.");
  });

  it("rejects a stored public key that is missing a coordinate", async () => {
    const store = createMemorySecureStore();
    const service = createUnboundUserKeyService({
      store,
      userKeyCrypto: createFixedCrypto(),
    });
    await store.setItem(USER_PUBLIC_KEY_STORAGE_KEY, JSON.stringify({ x: "1" }));

    await expect(service.load()).rejects.toThrow("Stored user public key is invalid.");
  });

  it("backfills a public key from a legacy private key without returning it", async () => {
    const reads: string[] = [];
    const values = new Map<string, string>();
    const store: SecureStorePort = {
      getItem: (key: string): Promise<string | null> => {
        reads.push(key);

        return Promise.resolve(values.get(key) ?? null);
      },
      setItem: (key: string, value: string): Promise<void> => {
        values.set(key, value);

        return Promise.resolve();
      },
      deleteItem: (key: string): Promise<void> => {
        values.delete(key);

        return Promise.resolve();
      },
    };
    values.set(USER_PRIVATE_KEY_STORAGE_KEY, "99");
    const service = createUnboundUserKeyService({
      store,
      userKeyCrypto: createFixedCrypto("99"),
    });

    await expect(service.load()).resolves.toEqual({ publicKey: fixedPublicKey });
    expect(values.get(USER_PUBLIC_KEY_STORAGE_KEY)).toBe(JSON.stringify(fixedPublicKey));

    reads.length = 0;
    await expect(service.load()).resolves.toEqual({ publicKey: fixedPublicKey });
    expect(reads).toEqual([USER_PUBLIC_KEY_STORAGE_KEY]);
  });
});
