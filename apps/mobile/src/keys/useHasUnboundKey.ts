import { useEffect, useState } from "react";

import { defaultUnboundUserKeys } from "./defaultUnboundUserKeys";

export interface UseHasUnboundKeyResult {
  ready: boolean;
  hasKey: boolean;
}

/**
 * @param recheckToken - Change this value to re-run the Secure Store check
 *   (for example the current pathname after navigation).
 */
export const useHasUnboundKey = (recheckToken = ""): UseHasUnboundKeyResult => {
  const [ready, setReady] = useState(false);
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    let cancelled = false;

    defaultUnboundUserKeys
      .load()
      .then((record) => {
        if (!cancelled) {
          setHasKey(record !== null);
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
