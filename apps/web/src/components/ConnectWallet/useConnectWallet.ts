import { useEffect, useState } from "react";

import { rpcUrlFor } from "../../config/network";
import { useNetwork } from "../../providers/Network";
import { wallet } from "../../services/wallet";

const CONNECT_ERROR_TOAST_MS = 4000;

interface UseConnectWalletResult {
  address?: string;
  error?: string;
  handleClick: () => Promise<void>;
  disconnect: () => Promise<void>;
}

export function useConnectWallet(): UseConnectWalletResult {
  const { network } = useNetwork();
  const [address, setAddress] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (error === undefined) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setError(undefined);
    }, CONNECT_ERROR_TOAST_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [error]);

  const handleClick = async (): Promise<void> => {
    setError(undefined);

    try {
      const next = await wallet.connect(rpcUrlFor(network));
      setAddress(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Connect failed");
    }
  };

  const disconnectWallet = async (): Promise<void> => {
    try {
      await wallet.disconnect();
    } finally {
      setAddress(undefined);
    }
  };

  return { address, error, handleClick, disconnect: disconnectWallet };
}
