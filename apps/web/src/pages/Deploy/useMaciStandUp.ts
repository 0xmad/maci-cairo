import { useCallback } from "react";

import { type UseOpsJobResult, useOpsJob } from "../../hooks/useOpsJob.js";
import { type StandUpBody } from "../../services/ops";
import { useOperatorSession } from "../../stores/operatorSession";
import { useStandUpJob } from "../../stores/standUpJob";

export interface UseMaciStandUpResult extends UseOpsJobResult {
  startStandUp: (intent: StandUpBody) => Promise<void>;
  discardStandUp: () => Promise<void>;
}

/** Wires Operator JWT into MACI stand-up on the ops job store. */
export function useMaciStandUp(): UseMaciStandUpResult {
  const token = useOperatorSession((session) => session.token);
  const startStoredJob = useStandUpJob((state) => state.startStandUp);
  const discardStoredJob = useStandUpJob((state) => state.discardStandUp);
  const job = useOpsJob();

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
    ...job,
    startStandUp,
    discardStandUp,
  };
}
