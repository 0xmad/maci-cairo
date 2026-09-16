import { useEffect } from "react";
import { useParams } from "react-router-dom";

import { type MaciInstance } from "../../services/ops";
import { useMaciInstanceStore } from "../../stores/maciInstance";
import { useOperatorSession } from "../../stores/operatorSession";

export interface UseMaciInstanceResult {
  address?: string;
  signedIn: boolean;
  instance?: MaciInstance;
  error?: string;
}

export function useMaciInstance(): UseMaciInstanceResult {
  const { address } = useParams();
  const token = useOperatorSession((session) => session.token);
  const signedIn = token !== undefined;
  const { instance, error, load, reset } = useMaciInstanceStore();

  useEffect(() => {
    if (token === undefined || address === undefined || address.length === 0) {
      reset();

      return;
    }

    load(token, address).catch(() => undefined);
  }, [token, address, load, reset]);

  return { address, signedIn, instance, error };
}
