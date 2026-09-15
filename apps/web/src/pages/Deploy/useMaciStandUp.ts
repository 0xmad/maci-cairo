import { useCallback, useEffect } from "react";

import { opsBaseUrl } from "../../config/ops";
import { OpsClient, type JobSnapshot, type JobStep, type StandUpBody } from "../../services/ops";
import { useOperatorSession } from "../../stores/operatorSession";
import { useStandUpJob } from "../../stores/standUpJob";

export interface UseMaciStandUpResult {
  signedIn: boolean;
  starting: boolean;
  discarding: boolean;
  running: boolean;
  incompleteStandUp: boolean;
  error?: string;
  job?: JobSnapshot;
  steps: JobStep[];
  startStandUp: (intent: StandUpBody) => Promise<void>;
  discardStandUp: () => Promise<void>;
}

/** Wires Operator JWT and job SSE into the stand-up job store. */
export function useMaciStandUp(): UseMaciStandUpResult {
  const token = useOperatorSession((session) => session.token);
  const signedIn = token !== undefined;
  const {
    starting,
    discarding,
    error,
    job,
    incompleteStandUp,
    steps,
    streamId,
    applySnapshot,
    applyEvent,
    failWatch,
    reset,
    startStandUp: startStoredJob,
    discardStandUp: discardStoredJob,
  } = useStandUpJob();

  useEffect(() => {
    if (token === undefined) {
      reset();

      return undefined;
    }

    const client = new OpsClient(opsBaseUrl());
    const abort = new AbortController();
    let cancelled = false;

    client
      .readJobState(token)
      .then((state) => {
        if (!cancelled) {
          applySnapshot(state.job, state.incompleteStandUp);
        }
      })
      .catch(() => undefined);

    client
      .subscribeJobEvents(
        token,
        (event) => {
          if (!cancelled) {
            applyEvent(event);
          }
        },
        abort.signal,
      )
      .catch((caught: unknown) => {
        if (!cancelled && caught instanceof Error && caught.name !== "AbortError") {
          failWatch(caught.message);
        }
      });

    return () => {
      cancelled = true;
      abort.abort();
    };
  }, [token, streamId, applySnapshot, applyEvent, failWatch, reset]);

  const startStandUp = useCallback(
    async (intent: StandUpBody): Promise<void> => {
      await startStoredJob(token, intent);
    },
    [startStoredJob, token],
  );

  const discardStandUp = useCallback(async (): Promise<void> => {
    await discardStoredJob(token);
  }, [discardStoredJob, token]);

  return {
    signedIn,
    starting,
    discarding,
    running: job?.status === "running",
    incompleteStandUp,
    error,
    job,
    steps,
    startStandUp,
    discardStandUp,
  };
}
