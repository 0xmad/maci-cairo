import { RpcProvider } from "starknet";

import { mapNetworks, rpcUrlFor, type AppNetwork } from "../../config/network";

export interface StarknetRpcCall {
  contractAddress: string;
  entrypoint: string;
}

/** Starknet JSON-RPC with one provider per Starknet app network. */
export class StarknetRpcService {
  readonly #providers: Record<AppNetwork, RpcProvider>;

  constructor(urls: Record<AppNetwork, string> = mapNetworks(rpcUrlFor)) {
    this.#providers = mapNetworks((network) => new RpcProvider({ nodeUrl: urls[network] }));
  }

  async callContract(network: AppNetwork, call: StarknetRpcCall): Promise<string[]> {
    return this.#providers[network].callContract(call);
  }
}

export const starknetRpcService = new StarknetRpcService();
