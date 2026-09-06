import { StarkZap } from "starkzap";

export type AppNetwork = "local" | "sepolia";

const LOCAL_RPC_DEFAULT = "http://127.0.0.1:5050/";
const SEPOLIA_RPC_DEFAULT = "https://starknet-sepolia.public.blastapi.io";

export function isAppNetwork(value: string): value is AppNetwork {
  return value === "local" || value === "sepolia";
}

export function defaultNetwork(): AppNetwork {
  return import.meta.env.VITE_NETWORK_ID === "sepolia" ? "sepolia" : "local";
}

export function rpcUrlFor(network: AppNetwork): string {
  if (network === "sepolia") {
    return import.meta.env.VITE_SEPOLIA_RPC_URL ?? SEPOLIA_RPC_DEFAULT;
  }

  return import.meta.env.VITE_RPC_URL ?? LOCAL_RPC_DEFAULT;
}

export function createSdk(network: AppNetwork): StarkZap {
  if (network === "sepolia") {
    return new StarkZap({ network: "sepolia", rpcUrl: rpcUrlFor(network) });
  }

  return new StarkZap({ network: "devnet", rpcUrl: rpcUrlFor(network) });
}
