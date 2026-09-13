import { toast } from "sonner";
import { create, type StoreApi, type UseBoundStore } from "zustand";

import { type JobStep } from "../services/ops";

const CONNECT_TOAST = "connect-wallet";
const STAND_UP_ERROR_TOAST = "maci-stand-up-error";
const STEP_TOAST_DURATION_MS = 4_000;

export interface ToastHost {
  success(message: string, options: { id: string; duration: number }): void;
  error(message: string, options: { id: string; duration: number; closeButton: boolean }): void;
}

export interface ShowConnectErrorArgs {
  operator?: string;
  walletError?: string;
  loginError?: string;
}

export interface ShowStandUpArgs {
  running: boolean;
  steps: JobStep[];
  error?: string;
}

export interface ToastState {
  lastStandUpStep?: { seq: number; message: string };
  showConnectError: (args: ShowConnectErrorArgs) => void;
  showStandUp: (args: ShowStandUpArgs) => void;
  reset: () => void;
}

function stepToastId(seq: number): string {
  return `maci-stand-up-step-${String(seq)}`;
}

export function createToastStore(host: ToastHost): UseBoundStore<StoreApi<ToastState>> {
  return create<ToastState>((set, get) => ({
    lastStandUpStep: undefined,
    showConnectError: ({ operator, walletError, loginError }: ShowConnectErrorArgs): void => {
      if (operator !== undefined) {
        return;
      }

      const message = walletError || loginError;

      if (!message) {
        return;
      }

      host.error(message, {
        id: CONNECT_TOAST,
        duration: Number.POSITIVE_INFINITY,
        closeButton: true,
      });
    },
    showStandUp: ({ running, steps, error }: ShowStandUpArgs): void => {
      if (error !== undefined && error.length > 0) {
        host.error(error, {
          id: STAND_UP_ERROR_TOAST,
          duration: Number.POSITIVE_INFINITY,
          closeButton: true,
        });
      }

      const current = steps.at(-1);

      if (!running || current === undefined) {
        const last = get().lastStandUpStep;

        if (last !== undefined) {
          host.success(last.message, { id: stepToastId(last.seq), duration: STEP_TOAST_DURATION_MS });
          set({ lastStandUpStep: undefined });
        }

        return;
      }

      steps.forEach((step) => {
        const message = `${step.kind} ${step.name}`;
        host.success(message, {
          id: stepToastId(step.seq),
          duration: step.seq === current.seq ? Number.POSITIVE_INFINITY : STEP_TOAST_DURATION_MS,
        });
      });

      set({ lastStandUpStep: { seq: current.seq, message: `${current.kind} ${current.name}` } });
    },
    reset: (): void => {
      set({ lastStandUpStep: undefined });
    },
  }));
}

function sonnerHost(): ToastHost {
  return {
    success: (message, options): void => {
      toast.success(message, options);
    },
    error: (message, options): void => {
      toast.error(message, options);
    },
  };
}

export const useToasts = createToastStore(sonnerHost());
