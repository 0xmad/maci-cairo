import { create, type StoreApi, type UseBoundStore } from "zustand";

import { opsBaseUrl } from "../config/ops";
import { OpsClient, type OperatorSession } from "../services/ops";

export interface OperatorLoginApi {
  issueNonce(): Promise<string>;
  login(nonce: string, signature: string): Promise<OperatorSession>;
  readSession(token: string): Promise<string>;
}

export interface OperatorLoginState {
  operator?: string;
  error?: string;
  restoring: boolean;
  generation: number;
  restore: (token: string | undefined) => Promise<void>;
  signIn: (
    walletAddress: string | undefined,
    signNonce: (nonce: string) => Promise<unknown>,
  ) => Promise<string | undefined>;
  reset: () => void;
}

const idleLogin: Pick<OperatorLoginState, "operator" | "error" | "restoring" | "generation"> = {
  operator: undefined,
  error: undefined,
  restoring: false,
  generation: 0,
};

export function createOperatorLoginStore(api: OperatorLoginApi): UseBoundStore<StoreApi<OperatorLoginState>> {
  return create<OperatorLoginState>((set, get) => ({
    ...idleLogin,
    restore: async (token: string | undefined): Promise<void> => {
      if (token === undefined || token.length === 0) {
        set({ operator: undefined, restoring: false });

        return;
      }

      const generation = get().generation + 1;

      set({ generation, restoring: true, error: undefined });

      try {
        const operator = await api.readSession(token);

        set((state) => (state.generation === generation ? { operator, restoring: false } : state));
      } catch (caught) {
        set((state) => (state.generation === generation ? { operator: undefined, restoring: false } : state));

        throw caught;
      }
    },
    signIn: async (
      walletAddress: string | undefined,
      signNonce: (nonce: string) => Promise<unknown>,
    ): Promise<string | undefined> => {
      if (walletAddress === undefined) {
        set({ error: "Connect a wallet first" });

        return undefined;
      }

      set({ error: undefined });

      try {
        const nonce = await api.issueNonce();
        const signature = await signNonce(nonce);
        const session = await api.login(nonce, JSON.stringify({ address: walletAddress, signature }));

        set({ operator: session.address });

        return session.token;
      } catch (caught) {
        set({ error: caught instanceof Error ? caught.message : "Sign-in failed" });

        return undefined;
      }
    },
    reset: (): void => {
      set(idleLogin);
    },
  }));
}

function defaultOperatorLoginApi(): OperatorLoginApi {
  return {
    issueNonce: (): Promise<string> => new OpsClient(opsBaseUrl()).issueNonce(),
    login: (nonce: string, signature: string): Promise<OperatorSession> =>
      new OpsClient(opsBaseUrl()).login(nonce, signature),
    readSession: (token: string): Promise<string> => new OpsClient(opsBaseUrl()).readSession(token),
  };
}

/** Operator address after JWT restore or sign-in. Wallet signing stays in `useOperatorLogin`. */
export const useOperatorLoginStore = createOperatorLoginStore(defaultOperatorLoginApi());
