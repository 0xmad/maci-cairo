import { type JSX } from "react";

import { truncateAddress } from "../../utils/truncateAddress";

import { useMaciInstance } from "./useMaciInstance";

function networkLabel(network: "starknet_local" | "sepolia"): string {
  return network === "sepolia" ? "Sepolia" : "Starknet Local";
}

export const MaciPage = (): JSX.Element => {
  const { signedIn, instance, error } = useMaciInstance();
  const hasMaci = instance !== undefined;

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">MACI</h1>

      {!signedIn ? <p>Sign in as Operator to view this MACI.</p> : null}

      {error !== undefined ? <p className="text-sm text-red-400">{error}</p> : null}

      {instance !== undefined ? (
        <dl className="grid gap-2 text-sm">
          {(
            [
              ["MACI", instance.maci],
              ["LeanIMT", instance.leanImt],
              ["Checker", instance.checker],
              ["Enforcer", instance.enforcer],
              ["Assigner", instance.assigner],
              ["Poll factory", instance.pollFactory],
              ["Poll class hash", instance.pollClassHash],
              ["Poll factory class hash", instance.pollFactoryClassHash],
              ["Coordinator", instance.coordinator],
              ["Deployer", instance.deployer],
              ["Network", networkLabel(instance.network)],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="grid grid-cols-[minmax(8rem,12rem)_1fr] gap-3">
              <dt className="text-zinc-400">{label}</dt>

              <dd className="font-mono break-all" title={value}>
                {label === "Network" ? value : truncateAddress(value)}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      <button
        className="rounded border border-zinc-600 px-3 py-1 text-sm disabled:opacity-50"
        disabled={!hasMaci}
        type="button"
      >
        Create Poll
      </button>

      {hasMaci ? <p className="text-sm text-zinc-400">Create Poll is not wired and sends no transaction.</p> : null}
    </section>
  );
};
