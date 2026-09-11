import { constants } from "starknet";
import { StarkZap } from "starkzap";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createSdk, chainIdFor, defaultNetwork, isAppNetwork, rpcUrlFor } from "../network";

vi.mock("starkzap", () => ({
  StarkZap: vi.fn(),
}));

const StarkZapMock = vi.mocked(StarkZap);

describe("isAppNetwork", () => {
  it("accepts local and sepolia", () => {
    expect(isAppNetwork("local")).toBe(true);
    expect(isAppNetwork("sepolia")).toBe(true);
  });

  it("rejects any other value", () => {
    expect(isAppNetwork("mainnet")).toBe(false);
    expect(isAppNetwork("")).toBe(false);
  });
});

describe("defaultNetwork", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns sepolia when VITE_NETWORK_ID is sepolia", () => {
    vi.stubEnv("VITE_NETWORK_ID", "sepolia");

    expect(defaultNetwork()).toBe("sepolia");
  });

  it("returns local when VITE_NETWORK_ID is not sepolia", () => {
    vi.stubEnv("VITE_NETWORK_ID", "local");

    expect(defaultNetwork()).toBe("local");
  });
});

describe("rpcUrlFor", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    (import.meta.env as { DEV: boolean }).DEV = true;
  });

  it("returns the sepolia env RPC when set", () => {
    vi.stubEnv("VITE_SEPOLIA_RPC_URL", "https://sepolia.test/");

    expect(rpcUrlFor("sepolia")).toBe("https://sepolia.test/");
  });

  it("returns the sepolia default RPC when unset", () => {
    const env = import.meta.env as { VITE_SEPOLIA_RPC_URL?: string };

    delete env.VITE_SEPOLIA_RPC_URL;

    expect(rpcUrlFor("sepolia")).toBe("https://starknet-sepolia.public.blastapi.io");
  });

  it("returns the local env RPC when set", () => {
    vi.stubEnv("VITE_RPC_URL", "http://rpc.test/");

    expect(rpcUrlFor("local")).toBe("http://rpc.test/");
  });

  it("proxies loopback starknet-devnet through Vite in development", () => {
    vi.stubEnv("VITE_RPC_URL", "http://127.0.0.1:5050/");

    expect(rpcUrlFor("local")).toBe(`${window.location.origin}/starknet-rpc`);
  });

  it("does not treat an unparseable RPC URL as loopback devnet", () => {
    vi.stubEnv("VITE_RPC_URL", "https://[");

    expect(rpcUrlFor("local")).toBe("https://[");
  });

  it("returns the Vite proxy RPC when local env is unset", () => {
    const env = import.meta.env as { VITE_RPC_URL?: string };

    delete env.VITE_RPC_URL;

    expect(rpcUrlFor("local")).toBe(`${window.location.origin}/starknet-rpc`);
  });

  it("returns the loopback RPC outside development when unset", () => {
    const env = import.meta.env as { DEV: boolean; VITE_RPC_URL?: string };

    env.DEV = false;
    delete env.VITE_RPC_URL;

    expect(rpcUrlFor("local")).toBe("http://127.0.0.1:5050/");
  });
});

describe("createSdk", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    StarkZapMock.mockClear();
  });

  it("constructs StarkZap for sepolia", () => {
    vi.stubEnv("VITE_SEPOLIA_RPC_URL", "https://sepolia.test/");

    createSdk("sepolia");

    expect(StarkZapMock).toHaveBeenCalledWith({
      network: "sepolia",
      rpcUrl: "https://sepolia.test/",
    });
  });

  it("constructs StarkZap for local as devnet", () => {
    vi.stubEnv("VITE_RPC_URL", "http://rpc.test/");

    createSdk("local");

    expect(StarkZapMock).toHaveBeenCalledWith({
      network: "devnet",
      rpcUrl: "http://rpc.test/",
    });
  });
});

describe("chainIdFor", () => {
  it("uses SN_SEPOLIA for local and sepolia", () => {
    expect(chainIdFor("local")).toBe(constants.StarknetChainId.SN_SEPOLIA);
    expect(chainIdFor("sepolia")).toBe(constants.StarknetChainId.SN_SEPOLIA);
  });
});
