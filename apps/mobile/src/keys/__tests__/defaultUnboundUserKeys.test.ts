import { getRandomBytes } from "expo-crypto";
import * as SecureStore from "expo-secure-store";

import { defaultUnboundUserKeys } from "../defaultUnboundUserKeys";
import { BASE8_TIMES_7, bigintToBytes32 } from "../testFixtures";
import { USER_PRIVATE_KEY_STORAGE_KEY, USER_PUBLIC_KEY_STORAGE_KEY } from "../unboundUserKey";

jest.mock("expo-secure-store", () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock("expo-crypto", () => ({
  getRandomBytes: jest.fn(),
}));

const getItemAsync = jest.mocked(SecureStore.getItemAsync);
const setItemAsync = jest.mocked(SecureStore.setItemAsync);
const deleteItemAsync = jest.mocked(SecureStore.deleteItemAsync);
const getRandomBytesMock = jest.mocked(getRandomBytes);

describe("defaultUnboundUserKeys", () => {
  beforeEach(() => {
    getItemAsync.mockReset();
    setItemAsync.mockReset();
    deleteItemAsync.mockReset();
    getRandomBytesMock.mockReset();
  });

  it("loads null when secure store has no unbound key", async () => {
    getItemAsync.mockResolvedValue(null);

    await expect(defaultUnboundUserKeys.load()).resolves.toBeNull();
    expect(getItemAsync).toHaveBeenCalledWith(USER_PUBLIC_KEY_STORAGE_KEY, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    expect(getItemAsync).toHaveBeenCalledWith(USER_PRIVATE_KEY_STORAGE_KEY, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  });

  it("creates a key with baby-jubjub crypto and persists it in secure store", async () => {
    getItemAsync.mockResolvedValue(null);
    setItemAsync.mockResolvedValue(undefined);
    getRandomBytesMock.mockReturnValue(bigintToBytes32(7n));

    const record = await defaultUnboundUserKeys.create();

    expect(record).toEqual({ publicKey: BASE8_TIMES_7 });
    expect(setItemAsync).toHaveBeenCalledWith(USER_PRIVATE_KEY_STORAGE_KEY, "7", {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    expect(setItemAsync).toHaveBeenCalledWith(USER_PUBLIC_KEY_STORAGE_KEY, JSON.stringify(BASE8_TIMES_7), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    expect(getItemAsync).toHaveBeenCalledWith(USER_PRIVATE_KEY_STORAGE_KEY, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  });

  it("loads an existing public key from secure store", async () => {
    getItemAsync.mockResolvedValue(JSON.stringify(BASE8_TIMES_7));

    await expect(defaultUnboundUserKeys.load()).resolves.toEqual({
      publicKey: BASE8_TIMES_7,
    });
    expect(getItemAsync).not.toHaveBeenCalledWith(USER_PRIVATE_KEY_STORAGE_KEY, expect.anything());
  });

  it("clears the private and public keys from secure store", async () => {
    deleteItemAsync.mockResolvedValue(undefined);

    await defaultUnboundUserKeys.clear();

    expect(deleteItemAsync).toHaveBeenCalledWith(USER_PRIVATE_KEY_STORAGE_KEY, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    expect(deleteItemAsync).toHaveBeenCalledWith(USER_PUBLIC_KEY_STORAGE_KEY, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  });
});
