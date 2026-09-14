import { create, type StoreApi, type UseBoundStore } from "zustand";

import { opsBaseUrl } from "../config/ops";
import { OpsClient, type StandUpCatalog } from "../services/ops";

export interface StandUpCatalogApi {
  readStandUpCatalog(token: string): Promise<StandUpCatalog>;
}

export interface StandUpCatalogState {
  catalog?: StandUpCatalog;
  error?: string;
  generation: number;
  load: (token: string | undefined) => Promise<void>;
  reset: () => void;
}

const idleCatalog: Pick<StandUpCatalogState, "catalog" | "error" | "generation"> = {
  catalog: undefined,
  error: undefined,
  generation: 0,
};

export function createStandUpCatalogStore(api: StandUpCatalogApi): UseBoundStore<StoreApi<StandUpCatalogState>> {
  return create<StandUpCatalogState>((set, get) => ({
    ...idleCatalog,
    load: async (token: string | undefined): Promise<void> => {
      if (token === undefined || token.length === 0) {
        set(idleCatalog);

        return;
      }

      const generation = get().generation + 1;

      set({ generation, error: undefined });

      try {
        const catalog = await api.readStandUpCatalog(token);

        set((state) => (state.generation === generation ? { catalog, error: undefined } : state));
      } catch (caught) {
        set((state) =>
          state.generation === generation
            ? { catalog: undefined, error: caught instanceof Error ? caught.message : "catalog failed" }
            : state,
        );
      }
    },
    reset: (): void => {
      set(idleCatalog);
    },
  }));
}

function defaultStandUpCatalogApi(): StandUpCatalogApi {
  return {
    readStandUpCatalog: (token: string): Promise<StandUpCatalog> =>
      new OpsClient(opsBaseUrl()).readStandUpCatalog(token),
  };
}

/** Authenticated stand-up catalog for Deploy selectors. Loading stays in `useStandUpCatalog`. */
export const useStandUpCatalogStore = createStandUpCatalogStore(defaultStandUpCatalogApi());
