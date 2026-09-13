import { type JSX, useEffect } from "react";

import { useToasts } from "../../stores/toast";
import { truncateAddress } from "../../utils/truncateAddress";

import { useConnectWallet } from "./useConnectWallet";
import { useOperatorLogin } from "./useOperatorLogin";

export const ConnectWallet = (): JSX.Element => {
  const { address, error, handleClick, disconnect } = useConnectWallet();
  const { operator, error: loginError, restoring, signIn, signOut } = useOperatorLogin(address);
  const showConnectError = useToasts((state) => state.showConnectError);

  useEffect(() => {
    showConnectError({ operator, walletError: error, loginError });
  }, [showConnectError, operator, error, loginError]);

  if (operator !== undefined) {
    return (
      <p className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-zinc-400">Operator</span>

        <span className="font-mono text-sm" title={operator}>
          {truncateAddress(operator)}
        </span>

        <button
          className="rounded border border-zinc-600 px-3 py-1 text-sm hover:bg-zinc-800"
          type="button"
          onClick={() => {
            signOut();
            disconnect().catch(() => undefined);
          }}
        >
          Disconnect
        </button>
      </p>
    );
  }

  if (restoring) {
    return (
      <p aria-busy="true" aria-label="Restoring Operator" className="flex flex-wrap items-center gap-3" role="status">
        <span className="h-4 w-16 animate-pulse rounded bg-zinc-800" />

        <span className="h-4 w-24 animate-pulse rounded bg-zinc-800" />

        <span className="h-7 w-24 animate-pulse rounded bg-zinc-800" />
      </p>
    );
  }

  return address === undefined ? (
    <button
      className="rounded border border-zinc-600 px-3 py-1 text-sm hover:bg-zinc-800"
      type="button"
      onClick={handleClick}
    >
      Connect
    </button>
  ) : (
    <button
      className="rounded border border-zinc-600 px-3 py-1 text-sm hover:bg-zinc-800"
      type="button"
      onClick={() => {
        signIn().catch(() => undefined);
      }}
    >
      Sign in as Operator
    </button>
  );
};
