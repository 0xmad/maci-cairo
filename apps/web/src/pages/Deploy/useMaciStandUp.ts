import { useCallback, useEffect } from "react";

import { opsBaseUrl } from "../../config/ops";
import { OpsClient, type JobSnapshot, type JobStep } from "../../services/ops";
import { useOperatorSession } from "../../stores/operatorSession";
import { useStandUpJob } from "../../stores/standUpJob";

export interface UseMaciStandUpResult {
  signedIn: boolean;
  starting: boolean;
  running: boolean;
  error?: string;
  job?: JobSnapshot;
  steps: JobStep[];
  startStandUp: () => Promise<void>;
}

/** Wires Operator JWT and job SSE into the stand-up job store. */
export function useMaciStandUp(): UseMaciStandUpResult {
  const token = useOperatorSession((session) => session.token);
  const signedIn = token !== undefined;
  const {
    starting,
    error,
    job,
    steps,
    streamId,
    applySnapshot,
    applyEvent,
    failWatch,
    reset,
    startStandUp: startStoredJob,
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
      .readJob(token)
      .then((snapshot) => {
        if (!cancelled) {
          applySnapshot(snapshot);
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

  const startStandUp = useCallback(async (): Promise<void> => {
    await startStoredJob(token);
  }, [startStoredJob, token]);

  return {
    signedIn,
    starting,
    running: job?.status === "running",
    error,
    job,
    steps,
    startStandUp,
  };
}
