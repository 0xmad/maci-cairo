import { useCallback, useEffect } from "react";

import { rpcUrlFor } from "../../config/network";
import { useNetwork } from "../../providers/Network";
import { operatorNonceMessage } from "../../services/ops/nonceMessage";
import { wallet } from "../../services/wallet";
import { useOperatorLoginStore } from "../../stores/operatorLogin";
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
  const { setToken, clearToken } = useOperatorSession();
  const { operator, error, restoring, restore, signIn: signInOperator, reset } = useOperatorLoginStore();

  useEffect(() => {
    restore(useOperatorSession.getState().token).catch(() => {
      clearToken();
    });
  }, [restore, clearToken]);

  const signIn = useCallback(async (): Promise<void> => {
    const sessionToken = await signInOperator(walletAddress, (nonce) =>
      wallet.signMessage(rpcUrlFor(network), operatorNonceMessage(nonce, "SN_SEPOLIA")),
    );

    if (sessionToken !== undefined) {
      setToken(sessionToken);
    }
  }, [network, setToken, signInOperator, walletAddress]);

  const signOut = useCallback((): void => {
    clearToken();
    reset();
  }, [clearToken, reset]);

  return { operator, error, restoring, signIn, signOut };
}
