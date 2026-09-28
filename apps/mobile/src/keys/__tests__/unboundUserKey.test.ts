import { fixedPublicKey } from "../testFixtures";
import {
  createUnboundUserKeyService,
  type SecureStorePort,
  type UserKeyCrypto,
  type UserPublicKey,
} from "../unboundUserKey";

const createMemoryStore = (): SecureStorePort => {
  const values = new Map<string, string>();

  return {
    getItem: (key: string): Promise<string | null> => Promise.resolve(values.get(key) ?? null),
    setItem: (key: string, value: string): Promise<void> => {
      values.set(key, value);

      return Promise.resolve();
    },
    deleteItem: (key: string): Promise<void> => {
      values.delete(key);

      return Promise.resolve();
    },
  };
};

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
  it("creates and stores a user private key when none exists", async () => {
    const service = createUnboundUserKeyService({
      store: createMemoryStore(),
      userKeyCrypto: createFixedCrypto("99"),
    });

    const record = await service.create();

    expect(record.privateKey).toBe("99");
    expect(record.publicKey).toEqual(fixedPublicKey);
    expect(await service.load()).toEqual(record);
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
      store: createMemoryStore(),
      userKeyCrypto,
    });

    const first = await service.create();
    const second = await service.create();

    expect(first).toEqual(second);
    expect(generateCount).toBe(1);
  });

  it("loads null when no unbound key is stored", async () => {
    const service = createUnboundUserKeyService({
      store: createMemoryStore(),
      userKeyCrypto: createFixedCrypto(),
    });

    expect(await service.load()).toBeNull();
  });

  it("clears a stored unbound key", async () => {
    const service = createUnboundUserKeyService({
      store: createMemoryStore(),
      userKeyCrypto: createFixedCrypto("99"),
    });

    await service.create();
    await service.clear();

    expect(await service.load()).toBeNull();
  });
});
