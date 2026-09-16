import { create, type StoreApi, type UseBoundStore } from "zustand";

import { opsBaseUrl } from "../config/ops";
import { OpsClient, type MaciListItem, type MaciListPage } from "../services/ops";

export const MACI_LIST_PAGE_SIZE = 10;

export interface MaciInstancesApi {
  listMacis(token: string, page: number, pageSize: number): Promise<MaciListPage>;
}

export interface MaciInstancesState {
  items: MaciListItem[];
  pageCount: number;
  error?: string;
  generation: number;
  load: (token: string | undefined, page: number) => Promise<void>;
  reset: () => void;
}

const idleList: Pick<MaciInstancesState, "items" | "pageCount" | "error" | "generation"> = {
  items: [],
  pageCount: 0,
  error: undefined,
  generation: 0,
};

export function createMaciInstancesStore(api: MaciInstancesApi): UseBoundStore<StoreApi<MaciInstancesState>> {
  return create<MaciInstancesState>((set, get) => ({
    ...idleList,
    load: async (token: string | undefined, page: number): Promise<void> => {
      if (token === undefined || token.length === 0) {
        set(idleList);

        return;
      }

      const generation = get().generation + 1;

      set({ generation, error: undefined });

      try {
        const result = await api.listMacis(token, page, MACI_LIST_PAGE_SIZE);

        set((state) =>
          state.generation === generation
            ? {
                items: result.items,
                pageCount: result.total === 0 ? 0 : Math.ceil(result.total / result.pageSize),
                error: undefined,
              }
            : state,
        );
      } catch (caught) {
        set((state) =>
          state.generation === generation
            ? { items: [], error: caught instanceof Error ? caught.message : "MACI list failed" }
            : state,
        );
      }
    },
    reset: (): void => {
      set(idleList);
    },
  }));
}

function defaultMaciInstancesApi(): MaciInstancesApi {
  return {
    listMacis: (token: string, page: number, pageSize: number): Promise<MaciListPage> =>
      new OpsClient(opsBaseUrl()).listMacis(token, page, pageSize),
  };
}

/** Authenticated MACI instance list for Home. Pagination stays in `useMaciInstances`. */
export const useMaciInstancesStore = createMaciInstancesStore(defaultMaciInstancesApi());
