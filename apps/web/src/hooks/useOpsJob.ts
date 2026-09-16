import { useEffect } from "react";

import { type JobSnapshot, type JobStep } from "../services/ops";
import { useOperatorSession } from "../stores/operatorSession";
import { useStandUpJob } from "../stores/standUpJob";

export interface UseOpsJobResult {
  signedIn: boolean;
  starting: boolean;
  discarding: boolean;
  running: boolean;
  incompleteStandUp: boolean;
  currentMaci: string | null;
  error?: string;
  job?: JobSnapshot;
  steps: JobStep[];
}

/** Wires Operator JWT and abort into the ops job store watch. */
export function useOpsJob(): UseOpsJobResult {
  const token = useOperatorSession((session) => session.token);
  const signedIn = token !== undefined;
  const { starting, discarding, error, job, incompleteStandUp, currentMaci, steps, streamId, watch } = useStandUpJob();

  useEffect(() => {
    const abort = new AbortController();

    watch(token, abort.signal).catch(() => undefined);

    return (): void => {
      abort.abort();
    };
  }, [token, streamId, watch]);

  return {
    signedIn,
    starting,
    discarding,
    running: job?.status === "running",
    incompleteStandUp,
    currentMaci,
    error,
    job,
    steps,
  };
}
