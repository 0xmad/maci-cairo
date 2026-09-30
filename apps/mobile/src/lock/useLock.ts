import { useCallback, useEffect, useSyncExternalStore } from "react";

import { createLock, type LockView, type VisitLock } from "./createLock";

export const defaultLock: VisitLock = createLock();

export interface LockSession {
  view: LockView;
  retry: () => void;
}

export const useLock = (lock: VisitLock = defaultLock): LockSession => {
  const view = useSyncExternalStore(lock.subscribe, lock.view, lock.view);
  const retry = useCallback((): void => {
    lock.foreground().catch(() => undefined);
  }, [lock]);

  useEffect(() => lock.watch(), [lock]);

  return { view, retry };
};
