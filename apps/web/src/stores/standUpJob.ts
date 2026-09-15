import { create, type StoreApi, type UseBoundStore } from "zustand";

import { opsBaseUrl } from "../config/ops";
import { OpsClient, type JobEvent, type JobSnapshot, type JobStep, type StandUpBody } from "../services/ops";

export interface StandUpJobApi {
  startStandUp(token: string, intent: StandUpBody): Promise<string>;
  readJobState(token: string): Promise<{ job?: JobSnapshot; incompleteStandUp: boolean }>;
  discardStandUp(token: string): Promise<void>;
}

export interface StandUpJobState {
  starting: boolean;
  discarding: boolean;
  error?: string;
  job?: JobSnapshot;
  incompleteStandUp: boolean;
  steps: JobStep[];
  streamId: number;
  applySnapshot: (snapshot: JobSnapshot | undefined, incompleteStandUp?: boolean) => void;
  applyEvent: (event: JobEvent) => void;
  failWatch: (error: string) => void;
  startStandUp: (token?: string, intent?: StandUpBody) => Promise<void>;
  discardStandUp: (token?: string) => Promise<void>;
  reset: () => void;
}

const idleJob: Pick<StandUpJobState, "starting" | "discarding" | "error" | "job" | "steps" | "incompleteStandUp"> = {
  starting: false,
  discarding: false,
  error: undefined,
  job: undefined,
  steps: [],
  incompleteStandUp: false,
};

function stepsFor(snapshot: JobSnapshot): JobStep[] {
  return snapshot.status === "running" ? snapshot.steps : [];
}

export function createStandUpJobStore(api: StandUpJobApi): UseBoundStore<StoreApi<StandUpJobState>> {
  return create<StandUpJobState>((set) => ({
    ...idleJob,
    streamId: 0,
    applySnapshot: (snapshot: JobSnapshot | undefined, incompleteStandUp?: boolean): void => {
      if (snapshot === undefined) {
        if (incompleteStandUp !== undefined) {
          set({ incompleteStandUp });
        }

        return;
      }

      set({
        job: snapshot,
        steps: stepsFor(snapshot),
        ...(incompleteStandUp === undefined ? {} : { incompleteStandUp }),
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

        set((current) => ({
          starting: false,
          streamId: current.streamId + 1,
          incompleteStandUp: state.incompleteStandUp,
          ...(state.job === undefined ? {} : { job: state.job, steps: stepsFor(state.job) }),
        }));
      } catch (caught) {
        set({
          starting: false,
          error: caught instanceof Error ? caught.message : "stand-up failed",
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

        set((current) => ({
          discarding: false,
          incompleteStandUp: state.incompleteStandUp,
          streamId: current.streamId + 1,
          ...(state.job === undefined ? {} : { job: state.job, steps: stepsFor(state.job) }),
        }));
      } catch (caught) {
        set({
          discarding: false,
          error: caught instanceof Error ? caught.message : "discard failed",
        });
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
    readJobState: (token: string): Promise<{ job?: JobSnapshot; incompleteStandUp: boolean }> =>
      new OpsClient(opsBaseUrl()).readJobState(token),
    discardStandUp: (token: string): Promise<void> => new OpsClient(opsBaseUrl()).discardStandUp(token),
  };
}

/** Live MACI stand-up job and step log. SSE subscription stays in `useMaciStandUp`. */
export const useStandUpJob = createStandUpJobStore(defaultStandUpJobApi());
