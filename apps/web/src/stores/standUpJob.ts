import { create, type StoreApi, type UseBoundStore } from "zustand";

import { opsBaseUrl } from "../config/ops";
import { OpsClient, type JobEvent, type JobSnapshot, type JobStep } from "../services/ops";

export interface StandUpJobApi {
  startStandUp(token: string): Promise<string>;
  readJob(token: string): Promise<JobSnapshot | undefined>;
}

export interface StandUpJobState {
  starting: boolean;
  error?: string;
  job?: JobSnapshot;
  steps: JobStep[];
  streamId: number;
  applySnapshot: (snapshot: JobSnapshot | undefined) => void;
  applyEvent: (event: JobEvent) => void;
  failWatch: (error: string) => void;
  startStandUp: (token: string | undefined) => Promise<void>;
  reset: () => void;
}

const idleJob: Pick<StandUpJobState, "starting" | "error" | "job" | "steps"> = {
  starting: false,
  error: undefined,
  job: undefined,
  steps: [],
};

function stepsFor(snapshot: JobSnapshot): JobStep[] {
  return snapshot.status === "running" ? snapshot.steps : [];
}

export function createStandUpJobStore(api: StandUpJobApi): UseBoundStore<StoreApi<StandUpJobState>> {
  return create<StandUpJobState>((set) => ({
    ...idleJob,
    streamId: 0,
    applySnapshot: (snapshot: JobSnapshot | undefined): void => {
      if (snapshot === undefined) {
        return;
      }

      set({ job: snapshot, steps: stepsFor(snapshot) });
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
      }));
    },
    failWatch: (error: string): void => {
      set({ error });
    },
    startStandUp: async (token: string | undefined): Promise<void> => {
      if (token === undefined || token.length === 0) {
        set({ error: "Sign in as Operator first" });

        return;
      }

      set({ error: undefined, starting: true, steps: [] });

      try {
        await api.startStandUp(token);
        const snapshot = await api.readJob(token);

        set((state) => ({
          starting: false,
          streamId: state.streamId + 1,
          ...(snapshot === undefined ? {} : { job: snapshot, steps: stepsFor(snapshot) }),
        }));
      } catch (caught) {
        set({
          starting: false,
          error: caught instanceof Error ? caught.message : "stand-up failed",
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
    startStandUp: (token: string): Promise<string> => new OpsClient(opsBaseUrl()).startStandUp(token),
    readJob: (token: string): Promise<JobSnapshot | undefined> => new OpsClient(opsBaseUrl()).readJob(token),
  };
}

/** Live MACI stand-up job and step log. SSE subscription stays in `useMaciStandUp`. */
export const useStandUpJob = createStandUpJobStore(defaultStandUpJobApi());
