import { babyJubUserKeyCrypto } from "./babyJubUserKeyCrypto";
import { expoSecureStorePort } from "./expoSecureStorePort";
import { createUnboundUserKeyService } from "./unboundUserKey";

export const defaultUnboundUserKeys = createUnboundUserKeyService({
  store: expoSecureStorePort,
  userKeyCrypto: babyJubUserKeyCrypto,
});
