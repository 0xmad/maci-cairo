import { type JSX, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { useToasts } from "../../stores/toast";
import { truncateAddress } from "../../utils/truncateAddress";

import { useMaciInstances } from "./useMaciInstances";
import { useMaciStandUp } from "./useMaciStandUp";

function networkLabel(network: "starknet_local" | "sepolia"): string {
  return network === "sepolia" ? "Sepolia" : "Starknet Local";
}

export const DeployPage = (): JSX.Element => {
  const { signedIn, starting, running, error, job, steps, startStandUp } = useMaciStandUp();
  const { items, page, pageCount, error: listError, nextPage, prevPage } = useMaciInstances(job?.status);
  const navigate = useNavigate();
  const showStandUp = useToasts((state) => state.showStandUp);

  useEffect(() => {
    showStandUp({ running, steps, error: error ?? job?.error });
  }, [showStandUp, running, steps, error, job?.error]);

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">MACI stand-up</h1>

      <p>Start a MACI from this console. Your wallet is only used to sign in; the server deploys it.</p>

      {signedIn ? (
        <button
          className="rounded border border-zinc-600 px-3 py-1 text-sm hover:bg-zinc-800 disabled:opacity-50"
          disabled={starting || running}
          type="button"
          onClick={() => {
            startStandUp().catch(() => undefined);
          }}
        >
          Start MACI stand-up
        </button>
      ) : (
        <p>Sign in as Operator to start MACI stand-up.</p>
      )}

      <h2 className="text-lg font-semibold">MACI instances</h2>

      {signedIn ? (
        <div className="space-y-2">
          {listError !== undefined ? <p className="text-sm text-red-400">{listError}</p> : null}

          {items.length === 0 ? (
            <p className="text-sm text-zinc-400">No MACI instances yet.</p>
          ) : (
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400">
                  <th className="py-2 font-medium">Address</th>

                  <th className="py-2 font-medium">Network</th>
                </tr>
              </thead>

              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.address}
                    className="cursor-pointer border-b border-zinc-800 hover:bg-zinc-900"
                    tabIndex={0}
                    onClick={() => {
                      navigate(`/maci/${item.address}`);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        navigate(`/maci/${item.address}`);
                      }
                    }}
                  >
                    <td className="py-2 font-mono">{truncateAddress(item.address)}</td>

                    <td className="py-2">{networkLabel(item.network)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {pageCount > 1 ? (
            <div className="flex items-center gap-3 text-sm">
              <button
                className="rounded border border-zinc-600 px-3 py-1 disabled:opacity-50"
                disabled={page <= 1}
                type="button"
                onClick={prevPage}
              >
                Previous
              </button>

              <p>{`Page ${String(page)} of ${String(pageCount)}`}</p>

              <button
                className="rounded border border-zinc-600 px-3 py-1 disabled:opacity-50"
                disabled={page >= pageCount}
                type="button"
                onClick={nextPage}
              >
                Next
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <p>Sign in as Operator to list MACI instances.</p>
      )}
    </section>
  );
};
