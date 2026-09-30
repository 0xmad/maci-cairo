import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";

import { defaultMaciBinding } from "../../keys/defaultMaciBinding";
import { defaultUnboundUserKeys } from "../../keys/defaultUnboundUserKeys";
import { configuredMaciAddress } from "../../keys/maciAddress";
import { type BoundUserKeyRecord } from "../../keys/maciBinding";
import { type UnboundUserKeyRecord, type UserPublicKey } from "../../keys/unboundUserKey";

import { copySerializedUserPublicKey } from "./copySerializedUserPublicKey";

export interface UseKeysResult {
  ready: boolean;
  record: UnboundUserKeyRecord | null;
  bound: BoundUserKeyRecord | null;
  maciAddress: string | null;
  hasStoredBinding: boolean;
  error: string | null;
  onCreate: () => void;
  onCopyPublicKey: () => void;
  onClearUnboundKey: () => void;
  onClearBoundKey: () => void;
  onBind: () => void;
}

const visiblePublicKey = (
  bound: BoundUserKeyRecord | null,
  record: UnboundUserKeyRecord | null,
): UserPublicKey | null => bound?.publicKey ?? record?.publicKey ?? null;

export const useKeys = (): UseKeysResult => {
  const router = useRouter();
  const [record, setRecord] = useState<UnboundUserKeyRecord | null>(null);
  const [bound, setBound] = useState<BoundUserKeyRecord | null>(null);
  const [hasStoredBinding, setHasStoredBinding] = useState(false);
  const [maciAddress, setMaciAddress] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([defaultUnboundUserKeys.load(), defaultMaciBinding.load(), defaultMaciBinding.hasStoredBinding()])
      .then(([loaded, loadedBinding, stored]) => {
        if (!cancelled) {
          setRecord(loaded);
          setBound(loadedBinding);
          setHasStoredBinding(stored);
          setMaciAddress(configuredMaciAddress());
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
    const publicKey = visiblePublicKey(bound, record);

    if (publicKey === null) {
      return;
    }

    copySerializedUserPublicKey(publicKey);
  }, [bound, record]);

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
        setError("Could not clear key.");
      });
  }, [router]);

  const onClearBoundKey = useCallback((): void => {
    setError(null);

    defaultMaciBinding
      .clear()
      .then(() => defaultUnboundUserKeys.clear())
      .then(() => {
        setBound(null);
        setRecord(null);
        setHasStoredBinding(false);
        setError(null);
        router.replace("/");
      })
      .catch(() => {
        setError("Could not clear key.");
      });
  }, [router]);

  const onBind = useCallback((): void => {
    setError(null);

    defaultMaciBinding
      .bind()
      .then((boundRecord) => {
        setBound(boundRecord);
        setRecord(null);
        setHasStoredBinding(true);
        setMaciAddress(boundRecord.maciAddress);
        setError(null);
      })
      .catch(() => {
        setError("Could not bind this key to the MACI.");
      });
  }, []);

  return {
    ready,
    record,
    bound,
    maciAddress,
    hasStoredBinding,
    error,
    onCreate,
    onCopyPublicKey,
    onClearUnboundKey,
    onClearBoundKey,
    onBind,
  };
};
