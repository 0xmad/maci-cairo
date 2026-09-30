import * as SecureStore from "expo-secure-store";

import { defaultMaciBinding } from "../defaultMaciBinding";
import { BOUND_USER_KEY_STORAGE_KEY, type MaciBindingService } from "../maciBinding";
import { BASE8_TIMES_7 } from "../testFixtures";
import { USER_PUBLIC_KEY_STORAGE_KEY } from "../unboundUserKey";

const CONFIGURED_MACI = "0x0000000000000000000000000000000000000000000000001234567890abcdef";

const loadConfiguredBinding = (): { binding: MaciBindingService; secureStore: typeof SecureStore } => {
  let binding: MaciBindingService | undefined;
  let secureStore: typeof SecureStore | undefined;

  jest.isolateModules(() => {
    /* eslint-disable @typescript-eslint/no-require-imports, global-require -- reload the module after the build address is set */
    secureStore = require("expo-secure-store") as typeof SecureStore;
    binding = (require("../defaultMaciBinding") as { defaultMaciBinding: MaciBindingService }).defaultMaciBinding;
    /* eslint-enable @typescript-eslint/no-require-imports, global-require */
  });

  if (binding === undefined || secureStore === undefined) {
    throw new Error("Configured MACI binding did not load.");
  }

  return { binding, secureStore };
};

const withConfiguredMaci = async (
  run: (binding: MaciBindingService, secureStore: typeof SecureStore) => Promise<void>,
): Promise<void> => {
  process.env.EXPO_PUBLIC_MACI_ADDRESS = CONFIGURED_MACI;

  try {
    const { binding, secureStore } = loadConfiguredBinding();

    await run(binding, secureStore);
  } finally {
    delete process.env.EXPO_PUBLIC_MACI_ADDRESS;
  }
};

jest.mock("expo-secure-store", () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const getItemAsync = jest.mocked(SecureStore.getItemAsync);

describe("defaultMaciBinding", () => {
  beforeEach(() => {
    getItemAsync.mockReset();
  });

  it("loads nothing when the build has no MACI address", async () => {
    await expect(defaultMaciBinding.load()).resolves.toBeNull();
    expect(getItemAsync).not.toHaveBeenCalled();
  });

  it("checks secure store for a stored binding", async () => {
    getItemAsync.mockResolvedValue(null);

    await expect(defaultMaciBinding.hasStoredBinding()).resolves.toBe(false);
    expect(getItemAsync).toHaveBeenCalledWith(BOUND_USER_KEY_STORAGE_KEY, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  });

  it("binds the stored public key to the configured MACI", async () => {
    await withConfiguredMaci(async (binding, secureStore) => {
      jest.mocked(secureStore.getItemAsync).mockImplementation((key) => {
        if (key === USER_PUBLIC_KEY_STORAGE_KEY) {
          return Promise.resolve(JSON.stringify(BASE8_TIMES_7));
        }

        return Promise.resolve(null);
      });
      jest.mocked(secureStore.setItemAsync).mockResolvedValue();

      await expect(binding.bind()).resolves.toEqual({
        maciAddress: CONFIGURED_MACI,
        publicKey: BASE8_TIMES_7,
      });
    });
  });

  it("does not bind when no public key is stored", async () => {
    await withConfiguredMaci(async (binding, secureStore) => {
      jest.mocked(secureStore.getItemAsync).mockResolvedValue(null);

      await expect(binding.bind()).rejects.toThrow("No unbound user key.");
    });
  });
});
