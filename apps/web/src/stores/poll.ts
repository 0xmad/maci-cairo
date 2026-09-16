import { create, type StoreApi, type UseBoundStore } from "zustand";

import { type AppNetwork } from "../config/network";
import { opsBaseUrl } from "../config/ops";
import { OpsClient, type Poll } from "../services/ops";
import { pollStarknetContractData, type PollContractData } from "../services/poll/pollStarknetContractData";

export interface PollApi {
  readPoll(token: string, pollAddress: string): Promise<Poll>;
}

export interface PollContractDataApi {
  read(network: AppNetwork, pollAddress: string): Promise<PollContractData>;
}

export interface PollState {
  poll?: Poll;
  ballotCount?: string;
  error?: string;
  generation: number;
  loadPollData: (token?: string, pollAddress?: string, network?: AppNetwork) => Promise<void>;
  reset: () => void;
}

const idlePoll: Pick<PollState, "poll" | "ballotCount" | "error" | "generation"> = {
  poll: undefined,
  ballotCount: undefined,
  error: undefined,
  generation: 0,
};

export function createPollStore(api: PollApi, contract: PollContractDataApi): UseBoundStore<StoreApi<PollState>> {
  return create<PollState>((set, get) => ({
    ...idlePoll,
    loadPollData: async (token?: string, pollAddress?: string, network?: AppNetwork): Promise<void> => {
      if (
        token === undefined ||
        token.length === 0 ||
        pollAddress === undefined ||
        pollAddress.length === 0 ||
        network === undefined
      ) {
        set(idlePoll);

        return;
      }

      const generation = get().generation + 1;

      set({ generation, error: undefined, ballotCount: undefined });

      try {
        const poll = await api.readPoll(token, pollAddress);

        if (get().generation !== generation) {
          return;
        }

        set({ poll, error: undefined });

        try {
          const data = await contract.read(network, poll.address);

          set((state) => (state.generation === generation ? { ballotCount: data.ballotCount } : state));
        } catch {
          set((state) => (state.generation === generation ? { ballotCount: undefined } : state));
        }
      } catch (caught) {
        set((state) =>
          state.generation === generation
            ? {
                poll: undefined,
                ballotCount: undefined,
                error: caught instanceof Error ? caught.message : "Poll failed",
              }
            : state,
        );
      }
    },
    reset: (): void => {
      set(idlePoll);
    },
  }));
}

function defaultPollApi(): PollApi {
  return {
    readPoll: (token: string, pollAddress: string): Promise<Poll> =>
      new OpsClient(opsBaseUrl()).readPoll(token, pollAddress),
  };
}

/** Authenticated Poll for the Poll page. Loading stays in `usePoll`. */
export const usePollStore = createPollStore(defaultPollApi(), pollStarknetContractData);
