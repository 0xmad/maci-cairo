import { useCallback, useEffect, useState } from "react";

import { rpcUrlFor } from "../../config/network";
import { opsBaseUrl } from "../../config/ops";
import { useNetwork } from "../../providers/Network";
import { storage } from "../../services/localStorage";
import { OpsClient } from "../../services/ops";
import { operatorNonceMessage } from "../../services/ops/nonceMessage";
import { wallet } from "../../services/wallet";

interface UseOperatorLoginResult {
  operator?: string;
  error?: string;
  restoring: boolean;
  signIn: () => Promise<void>;
  signOut: () => void;
}

export function useOperatorLogin(walletAddress?: string): UseOperatorLoginResult {
  const { network } = useNetwork();
  const [operator, setOperator] = useState<string>();
  const [error, setError] = useState<string>();
  const [restoring, setRestoring] = useState(() => storage.readStoredJwt() !== undefined);

  useEffect(() => {
    const token = storage.readStoredJwt();

    if (token === undefined) {
      return undefined;
    }

    const client = new OpsClient(opsBaseUrl());
    let cancelled = false;

    client
      .readSession(token)
      .then((address) => {
        if (!cancelled) {
          setOperator(address);
        }
      })
      .catch(() => {
        storage.clearStoredJwt();
      })
      .finally(() => {
        if (!cancelled) {
          setRestoring(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (): Promise<void> => {
    if (walletAddress === undefined) {
      setError("Connect a wallet first");

      return;
    }

    setError(undefined);

    try {
      const client = new OpsClient(opsBaseUrl());
      const nonce = await client.issueNonce();
      const signature = await wallet.signMessage(rpcUrlFor(network), operatorNonceMessage(nonce, "SN_SEPOLIA"));
      const session = await client.login(nonce, JSON.stringify({ address: walletAddress, signature }));
      storage.storeJwt(session.token);
      setOperator(session.address);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign-in failed");
    }
  }, [network, walletAddress]);

  const signOut = useCallback((): void => {
    storage.clearStoredJwt();
    setOperator(undefined);
    setError(undefined);
    setRestoring(false);
  }, []);

  return { operator, error, restoring, signIn, signOut };
}
