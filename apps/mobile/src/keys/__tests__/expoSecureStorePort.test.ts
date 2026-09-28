import * as SecureStore from "expo-secure-store";

import { expoSecureStorePort } from "../expoSecureStorePort";

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const getItemAsync = jest.mocked(SecureStore.getItemAsync);
const setItemAsync = jest.mocked(SecureStore.setItemAsync);
const deleteItemAsync = jest.mocked(SecureStore.deleteItemAsync);

describe("expoSecureStorePort", () => {
  beforeEach(() => {
    getItemAsync.mockReset();
    setItemAsync.mockReset();
    deleteItemAsync.mockReset();
  });

  it("reads through expo-secure-store getItemAsync", async () => {
    getItemAsync.mockResolvedValue("99");

    await expect(expoSecureStorePort.getItem("maci.unbound.userPrivateKey")).resolves.toBe("99");
    expect(getItemAsync).toHaveBeenCalledWith("maci.unbound.userPrivateKey");
  });

  it("returns null when expo-secure-store has no entry", async () => {
    getItemAsync.mockResolvedValue(null);

    await expect(expoSecureStorePort.getItem("missing")).resolves.toBeNull();
  });

  it("writes through expo-secure-store setItemAsync", async () => {
    setItemAsync.mockResolvedValue(undefined);

    await expoSecureStorePort.setItem("maci.unbound.userPrivateKey", "99");

    expect(setItemAsync).toHaveBeenCalledWith("maci.unbound.userPrivateKey", "99");
  });

  it("deletes through expo-secure-store deleteItemAsync", async () => {
    deleteItemAsync.mockResolvedValue(undefined);

    await expoSecureStorePort.deleteItem("maci.unbound.userPrivateKey");

    expect(deleteItemAsync).toHaveBeenCalledWith("maci.unbound.userPrivateKey");
  });
});
