import { type JSX } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "../../components/ui";
import { formatCreatedAt } from "../../utils/formatCreatedAt";
import { networkLabel } from "../../utils/networkLabel";
import { truncateAddress } from "../../utils/truncateAddress";

import { MACI_LIST_PAGE_SIZE, useMaciInstances } from "./useMaciInstances";

export const HomePage = (): JSX.Element => {
  const { signedIn, items, page, pageCount, error: listError, nextPage, prevPage } = useMaciInstances();
  const navigate = useNavigate();
  const emptyRowCount = Math.max(0, MACI_LIST_PAGE_SIZE - items.length);

  return (
    <section className="space-y-4">
      <h1 className="text-lg font-semibold">MACI instances</h1>

      {signedIn ? (
        <div className="space-y-2">
          {listError !== undefined ? <p className="text-sm text-red-400">{listError}</p> : null}

          {items.length === 0 ? (
            <p className="text-sm text-zinc-400">No MACI instances yet.</p>
          ) : (
            <div className="-mx-4 overflow-x-auto sm:mx-0">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400">
                    <th className="px-4 py-3 font-medium sm:px-0">Address</th>

                    <th className="px-4 py-3 font-medium sm:px-0">Network</th>

                    <th className="px-4 py-3 font-medium sm:px-0">Created at</th>
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
                      <td className="px-4 py-3 font-mono whitespace-nowrap sm:px-0">
                        <span className="md:hidden">{truncateAddress(item.address)}</span>

                        <span className="hidden md:inline" title={item.address}>
                          {item.address}
                        </span>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap sm:px-0">{networkLabel(item.network)}</td>

                      <td className="px-4 py-3 whitespace-nowrap sm:px-0">{formatCreatedAt(item.createdAtMs)}</td>
                    </tr>
                  ))}

                  {Array.from({ length: emptyRowCount }, (_, index) => (
                    <tr key={`empty-${String(index)}`} aria-hidden className="border-b border-zinc-800">
                      <td className="px-4 py-3 sm:px-0" colSpan={3}>
                        {"\u00a0"}
                      </td>
                    </tr>
                  ))}
                </tbody>

                <tfoot>
                  <tr>
                    <td className="px-4 pt-3 sm:px-0" colSpan={3}>
                      <div className="flex items-center gap-3 whitespace-nowrap text-sm">
                        <Button disabled={page <= 1} onClick={prevPage}>
                          Previous
                        </Button>

                        <p>{`Page ${String(page)} of ${String(pageCount)}`}</p>

                        <Button disabled={page >= pageCount} onClick={nextPage}>
                          Next
                        </Button>
                      </div>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      ) : (
        <p>Sign in as Operator to list MACI instances.</p>
      )}
    </section>
  );
};
