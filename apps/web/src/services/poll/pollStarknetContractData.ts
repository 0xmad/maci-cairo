import { type AppNetwork } from "../../config/network";
import { starknetRpcService, type StarknetRpcService } from "../rpc";

export interface PollContractData {
  ballotCount: string;
}

/** Live public Poll contract values. */
export class PollStarknetContractData {
  readonly #rpc: StarknetRpcService;

  constructor(rpc: StarknetRpcService = starknetRpcService) {
    this.#rpc = rpc;
  }

  async read(network: AppNetwork, pollAddress: string): Promise<PollContractData> {
    const result = await this.#rpc.callContract(network, {
      contractAddress: pollAddress,
      entrypoint: "ballot_count",
    });

    if (result.length === 0) {
      throw new Error("Ballot count failed");
    }

    return { ballotCount: BigInt(result[0]).toString() };
  }
}

export const pollStarknetContractData = new PollStarknetContractData();
