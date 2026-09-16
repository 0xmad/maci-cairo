import { create, type StoreApi, type UseBoundStore } from "zustand";

import { opsBaseUrl } from "../config/ops";
import { OpsClient, type MaciInstance } from "../services/ops";

export interface MaciInstanceApi {
  readMaci(token: string, address: string): Promise<MaciInstance>;
}

export interface MaciInstanceState {
  instance?: MaciInstance;
  error?: string;
  generation: number;
  load: (token?: string, address?: string) => Promise<void>;
  reset: () => void;
}

const idleInstance: Pick<MaciInstanceState, "instance" | "error" | "generation"> = {
  instance: undefined,
  error: undefined,
  generation: 0,
};

export function createMaciInstanceStore(api: MaciInstanceApi): UseBoundStore<StoreApi<MaciInstanceState>> {
  return create<MaciInstanceState>((set, get) => ({
    ...idleInstance,
    load: async (token?: string, address?: string): Promise<void> => {
      if (token === undefined || token.length === 0 || address === undefined || address.length === 0) {
        set(idleInstance);

        return;
      }

      const generation = get().generation + 1;

      set({ generation, error: undefined });

      try {
        const instance = await api.readMaci(token, address);

        set((state) => (state.generation === generation ? { instance, error: undefined } : state));
      } catch (caught) {
        set((state) =>
          state.generation === generation
            ? { instance: undefined, error: caught instanceof Error ? caught.message : "MACI instance failed" }
            : state,
        );
      }
    },
    reset: (): void => {
      set(idleInstance);
    },
  }));
}

function defaultMaciInstanceApi(): MaciInstanceApi {
  return {
    readMaci: (token: string, address: string): Promise<MaciInstance> =>
      new OpsClient(opsBaseUrl()).readMaci(token, address),
  };
}

/** Authenticated MACI instance for the instance page. Loading stays in `useMaciInstance`. */
export const useMaciInstanceStore = createMaciInstanceStore(defaultMaciInstanceApi());
