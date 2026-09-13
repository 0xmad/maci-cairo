import { create, type StoreApi, type UseBoundStore } from "zustand";

import { storage } from "../services/localStorage";

export interface JwtPersistence {
  readStoredJwt(): string | undefined;
  storeJwt(token: string): void;
  clearStoredJwt(): void;
}

export interface OperatorSessionState {
  token?: string;
  setToken: (token: string) => void;
  clearToken: () => void;
}

export function createOperatorSessionStore(persistence: JwtPersistence): UseBoundStore<StoreApi<OperatorSessionState>> {
  return create<OperatorSessionState>((set) => ({
    token: persistence.readStoredJwt(),
    setToken: (token: string): void => {
      persistence.storeJwt(token);
      set({ token });
    },
    clearToken: (): void => {
      persistence.clearStoredJwt();
      set({ token: undefined });
    },
  }));
}

/** Operator JWT shared across Connect and Deploy. Persistence stays in `storage`. */
export const useOperatorSession = createOperatorSessionStore(storage);
