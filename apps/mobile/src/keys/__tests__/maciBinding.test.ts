import { createMemorySecureStore } from "../../test/memorySecureStore";
import { BOUND_USER_KEY_STORAGE_KEY, createMaciBindingService, type MaciBindingService } from "../maciBinding";
import { fixedPublicKey } from "../testFixtures";
import {
  createUnboundUserKeyService,
  USER_PUBLIC_KEY_STORAGE_KEY,
  type SecureStorePort,
  type UnboundUserKeyService,
  type UserKeyCrypto,
  type UserPublicKey,
} from "../unboundUserKey";

const ADDRESS_A = "0x0000000000000000000000000000000000000000000000001234567890abcdef";
const ADDRESS_B = "0x00000000000000000000000000000000000000000000000000000000000000aa";

const createFixedCrypto = (privateKey: string): UserKeyCrypto => ({
  generatePrivateKey: (): string => privateKey,
  publicKeyFromPrivate: (key: string): UserPublicKey => {
    if (key !== privateKey) {
      throw new Error(`unexpected private key: ${key}`);
    }

    return fixedPublicKey;
  },
});

const bindingFor = (
  store: SecureStorePort,
  unbound: UnboundUserKeyService,
  maciAddress: string | null,
): MaciBindingService =>
  createMaciBindingService({
    store,
    maciAddress,
    loadPublicKey: async () => (await unbound.load())?.publicKey ?? null,
  });

const setup = (
  privateKey: string,
  maciAddress: string | null,
): { binding: MaciBindingService; unbound: UnboundUserKeyService; store: SecureStorePort } => {
  const store = createMemorySecureStore();
  const unbound = createUnboundUserKeyService({ store, userKeyCrypto: createFixedCrypto(privateKey) });

  return {
    store,
    unbound,
    binding: bindingFor(store, unbound, maciAddress),
  };
};

describe("MACI binding", () => {
  it("binds the unbound user private key to the configured MACI", async () => {
    const { binding, unbound } = setup("99", ADDRESS_A);

    await unbound.create();
    const bound = await binding.bind();

    expect(bound).toEqual({
      maciAddress: ADDRESS_A,
      publicKey: fixedPublicKey,
    });
    expect(await binding.load()).toEqual(bound);
    expect(await unbound.load()).toEqual({ publicKey: fixedPublicKey });
  });

  it("loads nothing when the key is not bound to the configured MACI", async () => {
    const { binding } = setup("99", ADDRESS_A);

    expect(await binding.load()).toBeNull();
    expect(await binding.hasStoredBinding()).toBe(false);
  });

  it("reports a stored binding when this build has no MACI address", async () => {
    const store = createMemorySecureStore();
    const unbound = createUnboundUserKeyService({ store, userKeyCrypto: createFixedCrypto("99") });
    const binding = bindingFor(store, unbound, ADDRESS_A);
    const unconfigured = bindingFor(store, unbound, null);

    await unbound.create();
    await binding.bind();

    expect(await unconfigured.hasStoredBinding()).toBe(true);
    expect(await unconfigured.load()).toBeNull();
  });

  it("keeps the original binding when bind is confirmed again", async () => {
    const store = createMemorySecureStore();
    const unbound = createUnboundUserKeyService({ store, userKeyCrypto: createFixedCrypto("99") });
    const binding = bindingFor(store, unbound, ADDRESS_A);

    await unbound.create();
    const bound = await binding.bind();

    const laterUnbound = createUnboundUserKeyService({
      store,
      userKeyCrypto: createFixedCrypto("7"),
    });
    await laterUnbound.create();
    const again = await binding.bind();

    expect(again).toEqual(bound);
    expect(await binding.load()).toEqual(bound);
    expect(await laterUnbound.load()).toEqual({ publicKey: fixedPublicKey });
  });

  it("does not store a binding when no unbound key exists", async () => {
    const { binding, unbound } = setup("99", ADDRESS_A);

    await expect(binding.bind()).rejects.toThrow("No unbound user key.");
    expect(await binding.load()).toBeNull();
    expect(await unbound.load()).toBeNull();
  });

  it("does not bind when no MACI address is configured", async () => {
    const { binding, unbound } = setup("99", null);

    await unbound.create();

    await expect(binding.bind()).rejects.toThrow("No MACI is configured.");
    expect(await binding.load()).toBeNull();
    expect(await unbound.load()).not.toBeNull();
  });

  it("does not replace a key bound to another MACI", async () => {
    const store = createMemorySecureStore();
    const firstUnbound = createUnboundUserKeyService({ store, userKeyCrypto: createFixedCrypto("99") });
    const firstBinding = bindingFor(store, firstUnbound, ADDRESS_A);

    await firstUnbound.create();
    const bound = await firstBinding.bind();

    const secondUnbound = createUnboundUserKeyService({ store, userKeyCrypto: createFixedCrypto("7") });
    const secondBinding = bindingFor(store, secondUnbound, ADDRESS_B);
    await secondUnbound.create();

    await expect(secondBinding.bind()).rejects.toThrow("A user private key is already bound to another MACI.");
    expect(await firstBinding.load()).toEqual(bound);
    expect(await secondBinding.load()).toBeNull();
    expect(await secondUnbound.load()).toEqual({ publicKey: fixedPublicKey });
  });

  it("rejects a stored binding that is not JSON", async () => {
    const { store, binding } = setup("99", ADDRESS_A);
    await store.setItem(BOUND_USER_KEY_STORAGE_KEY, "{");

    await expect(binding.load()).rejects.toThrow("Stored MACI binding is invalid.");
  });

  it("rejects a stored binding without a MACI address", async () => {
    const { store, binding } = setup("99", ADDRESS_A);
    await store.setItem(BOUND_USER_KEY_STORAGE_KEY, JSON.stringify({}));

    await expect(binding.hasStoredBinding()).rejects.toThrow("Stored MACI binding is invalid.");
  });

  it("rejects a stored binding without a public key", async () => {
    const { store, binding } = setup("99", ADDRESS_A);
    await store.setItem(BOUND_USER_KEY_STORAGE_KEY, JSON.stringify({ maciAddress: ADDRESS_A }));

    await expect(binding.load()).rejects.toThrow("Stored MACI binding is invalid.");
    await expect(binding.hasStoredBinding()).rejects.toThrow("Stored MACI binding is invalid.");
  });

  it("keeps the sealed public key when the live public key changes", async () => {
    const { store, binding, unbound } = setup("99", ADDRESS_A);

    await unbound.create();
    const bound = await binding.bind();
    await store.setItem(USER_PUBLIC_KEY_STORAGE_KEY, JSON.stringify({ x: "9", y: "9" }));

    expect(await binding.load()).toEqual(bound);
    expect(await binding.bind()).toEqual(bound);
    expect(await store.getItem(BOUND_USER_KEY_STORAGE_KEY)).toBe(JSON.stringify(bound));
  });

  it("clears a stored MACI binding", async () => {
    const { binding, unbound } = setup("99", ADDRESS_A);

    await unbound.create();
    await binding.bind();
    await binding.clear();

    expect(await binding.load()).toBeNull();
    expect(await binding.hasStoredBinding()).toBe(false);
    expect(await unbound.load()).toEqual({ publicKey: fixedPublicKey });
  });
});
