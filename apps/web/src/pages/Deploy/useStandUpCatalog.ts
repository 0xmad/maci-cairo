import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

import { type StandUpBody, type StandUpCatalog } from "../../services/ops";
import { useOperatorSession } from "../../stores/operatorSession";
import { useStandUpCatalogStore } from "../../stores/standUpCatalog";
import { useToasts } from "../../stores/toast";

import { useMaciStandUp } from "./useMaciStandUp.js";

export interface UseStandUpCatalogResult {
  catalog?: StandUpCatalog;
  error?: string;
  signedIn: boolean;
  starting: boolean;
  discarding: boolean;
  running: boolean;
  incompleteStandUp: boolean;
  startStandUp: (intent: StandUpBody) => Promise<void>;
  discardStandUp: () => Promise<void>;
}

/** Wires Operator JWT into the catalog store, stand-up toasts, and Home on success. */
export function useStandUpCatalog(): UseStandUpCatalogResult {
  const token = useOperatorSession((session) => session.token);
  const { catalog, error, load, reset } = useStandUpCatalogStore();
  const {
    signedIn,
    starting,
    discarding,
    running,
    incompleteStandUp,
    error: jobError,
    job,
    steps,
    startStandUp,
    discardStandUp,
  } = useMaciStandUp();
  const navigate = useNavigate();
  const showJob = useToasts((state) => state.showJob);
  const sawRunning = useRef(false);

  useEffect(() => {
    if (token === undefined) {
      reset();

      return;
    }

    load(token).catch(() => undefined);
  }, [token, load, reset]);

  useEffect(() => {
    showJob({ running, steps, error: jobError ?? job?.error });
  }, [showJob, running, steps, jobError, job?.error]);

  useEffect(() => {
    if (running) {
      sawRunning.current = true;
    }

    if (sawRunning.current && job?.status === "succeeded") {
      navigate("/");
    }
  }, [running, job?.status, navigate]);

  return {
    catalog,
    error,
    signedIn,
    starting,
    discarding,
    running,
    incompleteStandUp,
    startStandUp,
    discardStandUp,
  };
}
