import { type JSX } from "react";
import { NavLink, Outlet, useMatch } from "react-router-dom";

import { ConnectWallet } from "../../components/ConnectWallet";
import { NetworkSwitcher } from "../../components/NetworkSwitcher";
import { useNetwork } from "../../providers/Network";

export const Shell = (): JSX.Element => {
  const match = useMatch({ path: "/maci/:address", end: false });
  const address = match?.params.address;
  const { network } = useNetwork();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 px-4 py-4 sm:px-6">
        <nav className="flex gap-4 text-sm">
          <NavLink end className={({ isActive }) => (isActive ? "text-white" : "text-zinc-400")} to="/">
            Home
          </NavLink>

          <NavLink className={({ isActive }) => (isActive ? "text-white" : "text-zinc-400")} to="/deploy">
            Deploy
          </NavLink>
        </nav>

        <div className="flex flex-wrap items-center gap-4">
          <NetworkSwitcher />

          <ConnectWallet key={network} />
        </div>
      </header>

      {address !== undefined ? (
        <p className="border-b border-zinc-800 px-4 py-2 text-sm text-amber-200 sm:px-6">
          Showing this MACI on {network}. Contract addresses are network-specific.
        </p>
      ) : null}

      <main className="w-full px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
};
