import { type JSX } from "react";

import { Toast } from "../Toast";

import { useConnectWallet } from "./useConnectWallet";

export const ConnectWallet = (): JSX.Element => {
  const { address, error, handleClick } = useConnectWallet();

  if (address !== undefined) {
    return (
      <p>
        <span className="text-sm text-zinc-400">Connected</span>

        <span className="font-mono text-sm">{address}</span>
      </p>
    );
  }

  return (
    <>
      <button
        className="rounded border border-zinc-600 px-3 py-1 text-sm hover:bg-zinc-800"
        type="button"
        onClick={handleClick}
      >
        Connect
      </button>

      <Toast message={error} />
    </>
  );
};
