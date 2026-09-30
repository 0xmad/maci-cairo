import { useEffect, useState } from "react";

import { defaultMaciBinding } from "./defaultMaciBinding";
import { defaultUnboundUserKeys } from "./defaultUnboundUserKeys";

export interface UseHasUserKeyResult {
  ready: boolean;
  hasKey: boolean;
}

/**
 * @param recheckToken - Change this value to re-run the Secure Store check
 *   (for example the current pathname after navigation).
 */
export const useHasUserKey = (recheckToken = ""): UseHasUserKeyResult => {
  const [ready, setReady] = useState(false);
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    let cancelled = false;

    Promise.all([defaultUnboundUserKeys.load(), defaultMaciBinding.hasStoredBinding()])
      .then(([record, storedBinding]) => {
        if (!cancelled) {
          setHasKey(record !== null || storedBinding);
          setReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHasKey(false);
          setReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [recheckToken]);

  return { ready, hasKey };
};
