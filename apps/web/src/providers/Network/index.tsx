import { createContext, useContext, useMemo, useState, type JSX, type ReactNode } from "react";

import type { StarkZap } from "starkzap";

import { createSdk, defaultNetwork, type AppNetwork } from "../../config/network";

interface NetworkContextValue {
  network: AppNetwork;
  setNetwork: (network: AppNetwork) => void;
  sdk: StarkZap;
}

const NetworkContext = createContext<NetworkContextValue | undefined>(undefined);

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

  return value;
}
