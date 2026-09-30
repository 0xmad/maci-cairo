import { type SecureStorePort } from "../keys/unboundUserKey";

export const createMemorySecureStore = (): SecureStorePort => {
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
