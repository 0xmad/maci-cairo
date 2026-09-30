import { defaultUnboundUserKeys } from "./defaultUnboundUserKeys";
import { expoSecureStorePort } from "./expoSecureStorePort";
import { configuredMaciAddress } from "./maciAddress";
import { createMaciBindingService } from "./maciBinding";

export const defaultMaciBinding = createMaciBindingService({
  store: expoSecureStorePort,
  loadPublicKey: async () => (await defaultUnboundUserKeys.load())?.publicKey ?? null,
  maciAddress: configuredMaciAddress(),
});
