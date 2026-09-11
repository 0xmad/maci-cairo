import { connect, disconnect } from "@starknet-io/get-starknet";
import { stark, WalletAccount, type TypedData } from "starknet";

type ConnectModalMode = "alwaysAsk" | "neverAsk";

/** Browser wallet via get-starknet and starknet.js `WalletAccount`. */
export class Wallet {
  async connect(rpcUrl: string): Promise<string> {
    const account = await this.#account(rpcUrl, "alwaysAsk");

    if (account.address.length === 0) {
      throw new Error("Wallet connected without an address");
    }

    return account.address;
  }

  async signMessage(rpcUrl: string, typedData: TypedData): Promise<string[]> {
    const account = await this.#account(rpcUrl, "neverAsk");
    const signed = await account.signMessage(typedData);

    return stark.signatureToHexArray(signed);
  }

  async disconnect(): Promise<void> {
    await disconnect({ clearLastWallet: true });
  }

  async switchChain(chainId: string): Promise<void> {
    const selected = await connect({ modalMode: "neverAsk", exclude: ["metamask"] });

    if (selected === null) {
      return;
    }

    await selected.request({
      type: "wallet_switchStarknetChain",
      params: { chainId },
    });
  }

  async #account(rpcUrl: string, modalMode: ConnectModalMode): Promise<WalletAccount> {
    const selected = await connect({ modalMode, exclude: ["metamask"] });

    if (selected === null) {
      throw new Error(modalMode === "alwaysAsk" ? "No wallet selected" : "No wallet connected");
    }

    return WalletAccount.connect({ nodeUrl: rpcUrl }, selected);
  }
}

export const wallet = new Wallet();
