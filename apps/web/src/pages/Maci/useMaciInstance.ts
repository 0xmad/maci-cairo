import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { opsBaseUrl } from "../../config/ops";
import { OpsClient, type MaciInstance } from "../../services/ops";
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
  const [instance, setInstance] = useState<MaciInstance>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (token === undefined || address === undefined || address.length === 0) {
      setInstance(undefined);
      setError(undefined);

      return undefined;
    }

    const client = new OpsClient(opsBaseUrl());
    let cancelled = false;

    client
      .readMaci(token, address)
      .then((result) => {
        if (cancelled) {
          return;
        }

        setInstance(result);
        setError(undefined);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setInstance(undefined);
          setError(caught instanceof Error ? caught.message : "MACI instance failed");
        }
      });

    return (): void => {
      cancelled = true;
    };
  }, [token, address]);

  return { address, signedIn, instance, error };
}
