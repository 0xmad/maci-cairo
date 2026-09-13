import { useCallback, useEffect, useState } from "react";

import { rpcUrlFor } from "../../config/network";
import { opsBaseUrl } from "../../config/ops";
import { useNetwork } from "../../providers/Network";
import { OpsClient } from "../../services/ops";
import { operatorNonceMessage } from "../../services/ops/nonceMessage";
import { wallet } from "../../services/wallet";
import { useOperatorSession } from "../../stores/operatorSession";

interface UseOperatorLoginResult {
  operator?: string;
  error?: string;
  restoring: boolean;
  signIn: () => Promise<void>;
  signOut: () => void;
}

export function useOperatorLogin(walletAddress?: string): UseOperatorLoginResult {
  const { network } = useNetwork();
  const { token, setToken, clearToken } = useOperatorSession();
  const [operator, setOperator] = useState<string>();
  const [error, setError] = useState<string>();
  const [restoring, setRestoring] = useState(() => token !== undefined);

  useEffect(() => {
    const sessionToken = useOperatorSession.getState().token;

    if (sessionToken === undefined) {
      return undefined;
    }

    const client = new OpsClient(opsBaseUrl());
    let cancelled = false;

    client
      .readSession(sessionToken)
      .then((address) => {
        if (!cancelled) {
          setOperator(address);
        }
      })
      .catch(() => {
        clearToken();
      })
      .finally(() => {
        if (!cancelled) {
          setRestoring(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [clearToken]);

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
      setToken(session.token);
      setOperator(session.address);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign-in failed");
    }
  }, [network, setToken, walletAddress]);

  const signOut = useCallback((): void => {
    clearToken();
    setOperator(undefined);
    setError(undefined);
    setRestoring(false);
  }, [clearToken]);

  return { operator, error, restoring, signIn, signOut };
}
