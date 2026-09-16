import { create, type StoreApi, type UseBoundStore } from "zustand";

import { opsBaseUrl } from "../config/ops";
import {
  OpsClient,
  type CreatePollBody,
  type JobEvent,
  type JobSnapshot,
  type JobStep,
  type StandUpBody,
} from "../services/ops";

export interface StandUpJobApi {
  startStandUp(token: string, intent: StandUpBody): Promise<string>;
  startCreatePoll(token: string, maci: string, intent: CreatePollBody): Promise<string>;
  readJobState(token: string): Promise<{ job?: JobSnapshot; incompleteStandUp: boolean; currentMaci: string | null }>;
  discardStandUp(token: string): Promise<void>;
  subscribeJobEvents(token: string, onEvent: (event: JobEvent) => void, signal?: AbortSignal): Promise<void>;
}

export interface StandUpJobState {
  starting: boolean;
  discarding: boolean;
  error?: string;
  job?: JobSnapshot;
  incompleteStandUp: boolean;
  currentMaci: string | null;
  steps: JobStep[];
  streamId: number;
  applySnapshot: (snapshot: JobSnapshot | undefined, incompleteStandUp?: boolean, currentMaci?: string | null) => void;
  applyEvent: (event: JobEvent) => void;
  failWatch: (error: string) => void;
  startStandUp: (token?: string, intent?: StandUpBody) => Promise<void>;
  startCreatePoll: (token?: string, maci?: string, intent?: CreatePollBody) => Promise<void>;
  discardStandUp: (token?: string) => Promise<void>;
  watch: (token: string | undefined, signal?: AbortSignal) => Promise<void>;
  reset: () => void;
}

const idleJob: Pick<
  StandUpJobState,
  "starting" | "discarding" | "error" | "job" | "steps" | "incompleteStandUp" | "currentMaci"
> = {
  starting: false,
  discarding: false,
  error: undefined,
  job: undefined,
  steps: [],
  incompleteStandUp: false,
  currentMaci: null,
};

function stepsFor(snapshot: JobSnapshot): JobStep[] {
  return snapshot.status === "running" ? snapshot.steps : [];
}

function hydrateFromJobState(
  streamId: number,
  state: { job?: JobSnapshot; incompleteStandUp: boolean; currentMaci: string | null },
  extra: Partial<StandUpJobState>,
): Partial<StandUpJobState> {
  return {
    ...extra,
    streamId: streamId + 1,
    incompleteStandUp: state.incompleteStandUp,
    currentMaci: state.currentMaci,
    ...(state.job === undefined ? {} : { job: state.job, steps: stepsFor(state.job) }),
  };
}

export function createStandUpJobStore(api: StandUpJobApi): UseBoundStore<StoreApi<StandUpJobState>> {
  return create<StandUpJobState>((set, get) => ({
    ...idleJob,
    streamId: 0,
    applySnapshot: (
      snapshot: JobSnapshot | undefined,
      incompleteStandUp?: boolean,
      currentMaci?: string | null,
    ): void => {
      if (snapshot === undefined) {
        set({
          ...(incompleteStandUp === undefined ? {} : { incompleteStandUp }),
          ...(currentMaci === undefined ? {} : { currentMaci }),
        });

        return;
      }

      set({
        job: snapshot,
        steps: stepsFor(snapshot),
        ...(incompleteStandUp === undefined ? {} : { incompleteStandUp }),
        ...(currentMaci === undefined ? {} : { currentMaci }),
      });
    },
    applyEvent: (event: JobEvent): void => {
      if (event.type === "step") {
        set((state) => {
          if (state.steps.some((step) => step.seq === event.step.seq)) {
            return state;
          }

          return { steps: [...state.steps, event.step].sort((left, right) => left.seq - right.seq) };
        });

        return;
      }

      set((state) => ({
        job: state.job === undefined ? state.job : { ...state.job, status: event.status, error: event.error },
        steps: [],
        incompleteStandUp:
          event.status !== "succeeded" &&
          (state.incompleteStandUp || state.steps.some((step) => step.kind === "deploy")),
      }));
    },
    failWatch: (error: string): void => {
      set({ error });
    },
    startStandUp: async (token: string | undefined, intent?: StandUpBody): Promise<void> => {
      if (token === undefined || token.length === 0) {
        set({ error: "Sign in as Operator first" });

        return;
      }

      if (intent === undefined) {
        set({ error: "Choose a circuit profile, policy, and vote balance assigner" });

        return;
      }

      set({ error: undefined, starting: true, steps: [] });

      try {
        await api.startStandUp(token, intent);
        const state = await api.readJobState(token);

        set((current) => hydrateFromJobState(current.streamId, state, { starting: false }));
      } catch (caught) {
        set({
          starting: false,
          error: caught instanceof Error ? caught.message : "stand-up failed",
        });
      }
    },
    startCreatePoll: async (token?: string, maci?: string, intent?: CreatePollBody): Promise<void> => {
      if (token === undefined || token.length === 0) {
        set({ error: "Sign in as Operator first" });

        return;
      }

      if (maci === undefined || maci.length === 0) {
        set({ error: "MACI address required" });

        return;
      }

      if (intent === undefined) {
        set({ error: "Choose a schedule and Poll public key" });

        return;
      }

      set({ error: undefined, starting: true, steps: [] });

      try {
        await api.startCreatePoll(token, maci, intent);
        const state = await api.readJobState(token);

        set((current) => hydrateFromJobState(current.streamId, state, { starting: false }));
      } catch (caught) {
        set({
          starting: false,
          error: caught instanceof Error ? caught.message : "Create Poll failed",
        });
      }
    },
    discardStandUp: async (token: string | undefined): Promise<void> => {
      if (token === undefined || token.length === 0) {
        set({ error: "Sign in as Operator first" });

        return;
      }

      set({ error: undefined, discarding: true });

      try {
        await api.discardStandUp(token);
        const state = await api.readJobState(token);

        set((current) => hydrateFromJobState(current.streamId, state, { discarding: false }));
      } catch (caught) {
        set({
          discarding: false,
          error: caught instanceof Error ? caught.message : "discard failed",
        });
      }
    },
    watch: async (token: string | undefined, signal?: AbortSignal): Promise<void> => {
      if (token === undefined || token.length === 0) {
        get().reset();

        return;
      }

      try {
        const state = await api.readJobState(token);

        if (!signal?.aborted) {
          get().applySnapshot(state.job, state.incompleteStandUp, state.currentMaci);
        }
      } catch {
        /* snapshot hydrate is best-effort; the event stream is the live source */
      }

      try {
        await api.subscribeJobEvents(
          token,
          (event) => {
            if (!signal?.aborted) {
              get().applyEvent(event);
            }
          },
          signal,
        );
      } catch (caught) {
        if (signal?.aborted) {
          return;
        }

        if (caught instanceof Error && caught.name !== "AbortError") {
          get().failWatch(caught.message);
        }
      }
    },
    reset: (): void => {
      set({ ...idleJob, streamId: 0 });
    },
  }));
}

function defaultStandUpJobApi(): StandUpJobApi {
  return {
    startStandUp: (token: string, intent: StandUpBody): Promise<string> =>
      new OpsClient(opsBaseUrl()).startStandUp(token, intent),
    startCreatePoll: (token: string, maci: string, intent: CreatePollBody): Promise<string> =>
      new OpsClient(opsBaseUrl()).startCreatePoll(token, maci, intent),
    readJobState: (
      token: string,
    ): Promise<{ job?: JobSnapshot; incompleteStandUp: boolean; currentMaci: string | null }> =>
      new OpsClient(opsBaseUrl()).readJobState(token),
    discardStandUp: (token: string): Promise<void> => new OpsClient(opsBaseUrl()).discardStandUp(token),
    subscribeJobEvents: (token: string, onEvent: (event: JobEvent) => void, signal?: AbortSignal): Promise<void> =>
      new OpsClient(opsBaseUrl()).subscribeJobEvents(token, onEvent, signal),
  };
}

/** Live ops job and step log. Aborting the watch stays in `useOpsJob`. */
export const useStandUpJob = createStandUpJobStore(defaultStandUpJobApi());
