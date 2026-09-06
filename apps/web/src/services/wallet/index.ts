export interface InjectedWallet {
  enable?: () => Promise<string[] | string>;
  request?: (args: { type: string }) => Promise<unknown>;
  selectedAddress?: string;
  account?: { address?: string };
}

function asWindow(): Window & {
  starknet_argentX?: InjectedWallet;
  starknet_braavos?: InjectedWallet;
} {
  return window;
}

export function findInjectedWallet(): InjectedWallet | undefined {
  const w = asWindow();
  return w.starknet_argentX ?? w.starknet_braavos;
}

export async function connectInjectedWallet(): Promise<string> {
  const wallet = findInjectedWallet();

  if (wallet === undefined) {
    throw new Error("No Argent or Braavos wallet found");
  }

  if (typeof wallet.enable === "function") {
    const accounts = await wallet.enable();
    const first = Array.isArray(accounts) ? accounts[0] : accounts;

    if (typeof first === "string" && first.length > 0) {
      return first;
    }
  }

  if (typeof wallet.request === "function") {
    await wallet.request({ type: "wallet_requestAccounts" });
  }

  const address = wallet.selectedAddress ?? wallet.account?.address;

  if (address === undefined || address.length === 0) {
    throw new Error("Wallet connected without an address");
  }

  return address;
}
