import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";

import { defaultUnboundUserKeys } from "../../keys/defaultUnboundUserKeys";
import { type UnboundUserKeyRecord } from "../../keys/unboundUserKey";

import { copySerializedUserPublicKey } from "./copySerializedUserPublicKey";

export interface UseKeysResult {
  ready: boolean;
  record: UnboundUserKeyRecord | null;
  error: string | null;
  onCreate: () => void;
  onCopyPublicKey: () => void;
  onClearUnboundKey: () => void;
}

export const useKeys = (): UseKeysResult => {
  const router = useRouter();
  const [record, setRecord] = useState<UnboundUserKeyRecord | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    defaultUnboundUserKeys
      .load()
      .then((loaded) => {
        if (!cancelled) {
          setRecord(loaded);
          setError(null);
          setReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not load keys.");
          setReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const onCreate = useCallback((): void => {
    setError(null);
    defaultUnboundUserKeys
      .create()
      .then((created) => {
        setRecord(created);
        setError(null);
      })
      .catch(() => {
        setError("Could not create user private key.");
      });
  }, []);

  const onCopyPublicKey = useCallback((): void => {
    if (record === null) {
      return;
    }

    copySerializedUserPublicKey(record.publicKey);
  }, [record]);

  const onClearUnboundKey = useCallback((): void => {
    setError(null);

    defaultUnboundUserKeys
      .clear()
      .then(() => {
        setRecord(null);
        setError(null);
        router.replace("/");
      })
      .catch(() => {
        setError("Could not clear unbound key.");
      });
  }, [router]);

  return { ready, record, error, onCreate, onCopyPublicKey, onClearUnboundKey };
};
