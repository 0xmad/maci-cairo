import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type JSX,
  type ReactNode,
  type SetStateAction,
} from "react";

import type { StarkZap } from "starkzap";

import { chainIdFor, createSdk, defaultNetwork, type AppNetwork } from "../../config/network";
import { storage } from "../../services/localStorage";
import { wallet } from "../../services/wallet";

interface NetworkStore {
  network: AppNetwork;
  setNetwork: Dispatch<SetStateAction<AppNetwork>>;
  sdk: StarkZap;
}

interface NetworkContextValue {
  network: AppNetwork;
  sdk: StarkZap;
  setNetwork: (network: AppNetwork) => Promise<void>;
}

const NetworkContext = createContext<NetworkStore | undefined>(undefined);

export const NetworkProvider = ({ children }: { children: ReactNode }): JSX.Element => {
  const [network, setNetwork] = useState<AppNetwork>(defaultNetwork);
  const sdk = useMemo(() => createSdk(network), [network]);
  const value = useMemo(() => ({ network, setNetwork, sdk }), [network, sdk]);

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
};

export function useNetwork(): NetworkContextValue {
  const value = useContext(NetworkContext);

  if (value === undefined) {
    throw new Error("useNetwork must be used within NetworkProvider");
  }

  const setNetwork = async (next: AppNetwork): Promise<void> => {
    if (next === value.network) {
      return;
    }

    try {
      await wallet.switchChain(chainIdFor(next));
    } catch {
      /* wallet refused or the chain is unlisted */
    }

    storage.clearStoredJwt();
    await wallet.disconnect().catch(() => undefined);
    value.setNetwork(next);
  };

  return { network: value.network, sdk: value.sdk, setNetwork };
}
