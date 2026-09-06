import { useEffect, useState } from "react";

import { connectInjectedWallet } from "../../services/wallet";

const CONNECT_ERROR_TOAST_MS = 4000;

interface UseConnectWalletResult {
  address?: string;
  error?: string;
  handleClick: () => Promise<void>;
}

export function useConnectWallet(): UseConnectWalletResult {
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
      const next = await connectInjectedWallet();
      setAddress(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Connect failed");
    }
  };

  return { address, error, handleClick };
}
