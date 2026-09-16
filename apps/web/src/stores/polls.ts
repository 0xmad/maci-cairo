import { create, type StoreApi, type UseBoundStore } from "zustand";

import { opsBaseUrl } from "../config/ops";
import { OpsClient, type PollListItem, type PollListPage } from "../services/ops";

export const POLL_LIST_PAGE_SIZE = 10;

export interface PollsApi {
  listPolls(token: string, maci: string, page: number, pageSize: number): Promise<PollListPage>;
}

export interface PollsState {
  items: PollListItem[];
  pageCount: number;
  error?: string;
  generation: number;
  load: (token: string | undefined, maci: string | undefined, page: number) => Promise<void>;
  reset: () => void;
}

const idleList: Pick<PollsState, "items" | "pageCount" | "error" | "generation"> = {
  items: [],
  pageCount: 0,
  error: undefined,
  generation: 0,
};

export function createPollsStore(api: PollsApi): UseBoundStore<StoreApi<PollsState>> {
  return create<PollsState>((set, get) => ({
    ...idleList,
    load: async (token: string | undefined, maci: string | undefined, page: number): Promise<void> => {
      if (token === undefined || token.length === 0 || maci === undefined || maci.length === 0) {
        set(idleList);

        return;
      }

      const generation = get().generation + 1;

      set({ generation, error: undefined });

      try {
        const result = await api.listPolls(token, maci, page, POLL_LIST_PAGE_SIZE);

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
            ? { items: [], error: caught instanceof Error ? caught.message : "Poll list failed" }
            : state,
        );
      }
    },
    reset: (): void => {
      set(idleList);
    },
  }));
}

function defaultPollsApi(): PollsApi {
  return {
    listPolls: (token: string, maci: string, page: number, pageSize: number): Promise<PollListPage> =>
      new OpsClient(opsBaseUrl()).listPolls(token, maci, page, pageSize),
  };
}

/** Authenticated Poll list for a MACI instance. Pagination stays in `usePolls`. */
export const usePollsStore = createPollsStore(defaultPollsApi());
