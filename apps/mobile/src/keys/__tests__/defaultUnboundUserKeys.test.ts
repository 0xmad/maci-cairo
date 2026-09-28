import { getRandomBytes } from "expo-crypto";
import * as SecureStore from "expo-secure-store";

import { defaultUnboundUserKeys } from "../defaultUnboundUserKeys";
import { BASE8_TIMES_7, bigintToBytes32 } from "../testFixtures";
import { UNBOUND_USER_PRIVATE_KEY_STORAGE_KEY } from "../unboundUserKey";

jest.mock("expo-secure-store", () => ({
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
    expect(getItemAsync).toHaveBeenCalledWith(UNBOUND_USER_PRIVATE_KEY_STORAGE_KEY);
  });

  it("creates a key with baby-jubjub crypto and persists it in secure store", async () => {
    getItemAsync.mockResolvedValue(null);
    setItemAsync.mockResolvedValue(undefined);
    getRandomBytesMock.mockReturnValue(bigintToBytes32(7n));

    const record = await defaultUnboundUserKeys.create();

    expect(record).toEqual({ privateKey: "7", publicKey: BASE8_TIMES_7 });
    expect(setItemAsync).toHaveBeenCalledWith(UNBOUND_USER_PRIVATE_KEY_STORAGE_KEY, "7");
  });

  it("loads an existing unbound key from secure store", async () => {
    getItemAsync.mockResolvedValue("7");

    await expect(defaultUnboundUserKeys.load()).resolves.toEqual({
      privateKey: "7",
      publicKey: BASE8_TIMES_7,
    });
  });

  it("clears the unbound key from secure store", async () => {
    deleteItemAsync.mockResolvedValue(undefined);

    await defaultUnboundUserKeys.clear();

    expect(deleteItemAsync).toHaveBeenCalledWith(UNBOUND_USER_PRIVATE_KEY_STORAGE_KEY);
  });
});
