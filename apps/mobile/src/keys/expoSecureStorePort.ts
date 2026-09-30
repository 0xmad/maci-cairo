import * as SecureStore from "expo-secure-store";

import { type SecureStorePort } from "./unboundUserKey";

const thisDeviceOnly: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export const expoSecureStorePort: SecureStorePort = {
  getItem: (key: string): Promise<string | null> => SecureStore.getItemAsync(key, thisDeviceOnly),
  setItem: (key: string, value: string): Promise<void> => SecureStore.setItemAsync(key, value, thisDeviceOnly),
  deleteItem: (key: string): Promise<void> => SecureStore.deleteItemAsync(key, thisDeviceOnly),
};
