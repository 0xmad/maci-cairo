import { type JSX } from "react";

export const DeployPage = (): JSX.Element => (
  <section className="space-y-4">
    <h1 className="text-2xl font-semibold">Deploy MACI</h1>

    <p>Not wired. This page will declare and deploy the contract graph; it does not act as Coordinator.</p>

    <div className="rounded border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-300">
      <p className="mb-2 font-medium text-zinc-100">Future deploy graph (dev)</p>

      <ol className="list-decimal space-y-1 pl-5">
        <li>LeanIMT</li>

        <li>Policy Checker, then Enforcer</li>

        <li>Vote-balance assigner</li>

        <li>Declare Poll and PollFactory class hashes</li>

        <li>MACI (Coordinator defaults to the connected wallet, optional override)</li>

        <li>Enforcer set_target(MACI)</li>
      </ol>
    </div>
  </section>
);
