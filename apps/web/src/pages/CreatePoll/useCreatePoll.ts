import { useCallback, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { type UseOpsJobResult, useOpsJob } from "../../hooks/useOpsJob.js";
import { type CreatePollBody } from "../../services/ops";
import { useOperatorSession } from "../../stores/operatorSession";
import { useStandUpJob } from "../../stores/standUpJob";
import { useToasts } from "../../stores/toast";
import { useMaciInstance } from "../Maci/useMaciInstance.js";

export interface UseCreatePollResult extends UseOpsJobResult {
  recordedMaci: boolean;
  startCreatePoll: (intent: CreatePollBody) => Promise<void>;
}

/** Wires Operator JWT, the MACI in the URL, job toasts, and the instance page on success. */
export function useCreatePoll(): UseCreatePollResult {
  const { address } = useParams();
  const navigate = useNavigate();
  const token = useOperatorSession((session) => session.token);
  const startStoredCreatePoll = useStandUpJob((state) => state.startCreatePoll);
  const { instance } = useMaciInstance();
  const { signedIn, starting, discarding, running, incompleteStandUp, currentMaci, error, job, steps } = useOpsJob();
  const showJob = useToasts((state) => state.showJob);
  const sawRunning = useRef(false);

  useEffect(() => {
    showJob({ running, steps, error: error ?? job?.error });
  }, [showJob, running, steps, error, job?.error]);

  useEffect(() => {
    if (running) {
      sawRunning.current = true;
    }

    if (sawRunning.current && job?.kind === "create_poll" && job.status === "succeeded" && address !== undefined) {
      navigate(`/maci/${address}`);
    }
  }, [running, job, address, navigate]);

  const startCreatePoll = useCallback(
    async (intent: CreatePollBody): Promise<void> => {
      await startStoredCreatePoll(token, address, intent);
    },
    [startStoredCreatePoll, token, address],
  );

  return {
    signedIn,
    starting,
    discarding,
    running,
    incompleteStandUp,
    currentMaci,
    error,
    job,
    steps,
    recordedMaci: instance !== undefined,
    startCreatePoll,
  };
}
