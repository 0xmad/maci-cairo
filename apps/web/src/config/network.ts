import { constants } from "starknet";
import { StarkZap } from "starkzap";

export const APP_NETWORKS = ["local", "sepolia"] as const;

export type AppNetwork = (typeof APP_NETWORKS)[number];

const LOCAL_RPC_DEFAULT = "http://127.0.0.1:5050/";
const LOCAL_DEV_PROXY = "/starknet-rpc";
const SEPOLIA_RPC_DEFAULT = "https://starknet-sepolia.public.blastapi.io";

export function isAppNetwork(value: string): value is AppNetwork {
  return (APP_NETWORKS as readonly string[]).includes(value);
}

export function mapNetworks<T>(create: (network: AppNetwork) => T): Record<AppNetwork, T> {
  return Object.fromEntries(APP_NETWORKS.map((network) => [network, create(network)])) as Record<AppNetwork, T>;
}

export function defaultNetwork(): AppNetwork {
  return import.meta.env.VITE_NETWORK_ID === "sepolia" ? "sepolia" : "local";
}

function isLoopbackDevnet(url: string): boolean {
  try {
    const parsed = new URL(url, "http://localhost");

    return (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost") && parsed.port === "5050";
  } catch {
    return false;
  }
}

function viteDevnetProxyUrl(): string {
  return new URL(LOCAL_DEV_PROXY, globalThis.location.origin).href;
}

function localRpcUrl(): string {
  const configured = import.meta.env.VITE_RPC_URL;

  if (import.meta.env.DEV && (configured === undefined || isLoopbackDevnet(configured))) {
    return viteDevnetProxyUrl();
  }

  return configured ?? LOCAL_RPC_DEFAULT;
}

export function rpcUrlFor(network: AppNetwork): string {
  if (network === "sepolia") {
    return import.meta.env.VITE_SEPOLIA_RPC_URL ?? SEPOLIA_RPC_DEFAULT;
  }

  return localRpcUrl();
}

export function chainIdFor(network: AppNetwork): string {
  // TODO: temp until new networks are supported
  if (network === "sepolia") {
    return constants.StarknetChainId.SN_SEPOLIA;
  }

  return constants.StarknetChainId.SN_SEPOLIA;
}

export function createSdk(network: AppNetwork): StarkZap {
  if (network === "sepolia") {
    return new StarkZap({ network: "sepolia", rpcUrl: rpcUrlFor(network) });
  }

  return new StarkZap({ network: "devnet", rpcUrl: rpcUrlFor(network) });
}
