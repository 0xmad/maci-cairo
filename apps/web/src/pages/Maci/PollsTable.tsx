import { type JSX } from "react";

import { Button } from "../../components/ui";
import { type PollListItem } from "../../services/ops";
import { formatCreatedAt, formatUnixSeconds } from "../../utils/formatCreatedAt";
import { truncateAddress } from "../../utils/truncateAddress.js";

import { POLL_LIST_PAGE_SIZE } from "./usePolls.js";

export interface PollsTableProps {
  items: PollListItem[];
  page: number;
  pageCount: number;
  error?: string;
  nextPage: () => void;
  prevPage: () => void;
}

export const PollsTable = ({ items, page, pageCount, error, nextPage, prevPage }: PollsTableProps): JSX.Element => {
  const emptyRowCount = Math.max(0, POLL_LIST_PAGE_SIZE - items.length);

  return (
    <div className="space-y-2">
      <h2 className="text-lg font-semibold">Polls</h2>

      {error !== undefined ? <p className="text-sm text-red-400">{error}</p> : null}

      {items.length === 0 ? (
        <p className="text-sm text-zinc-400">No polls yet.</p>
      ) : (
        <div className="-mx-4 overflow-x-auto sm:mx-0">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400">
                <th className="px-4 py-3 font-medium sm:px-0">Address</th>

                <th className="px-4 py-3 font-medium sm:px-0">Poll id</th>

                <th className="px-4 py-3 font-medium sm:px-0">Start</th>

                <th className="px-4 py-3 font-medium sm:px-0">End</th>

                <th className="px-4 py-3 font-medium sm:px-0">Created at</th>
              </tr>
            </thead>

            <tbody>
              {items.map((item) => (
                <tr key={item.address} className="border-b border-zinc-800">
                  <td className="px-4 py-3 font-mono whitespace-nowrap sm:px-0" title={item.address}>
                    {truncateAddress(item.address)}
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap sm:px-0">{item.pollId}</td>

                  <td className="px-4 py-3 whitespace-nowrap sm:px-0">{formatUnixSeconds(item.startDate)}</td>

                  <td className="px-4 py-3 whitespace-nowrap sm:px-0">{formatUnixSeconds(item.endDate)}</td>

                  <td className="px-4 py-3 whitespace-nowrap sm:px-0">{formatCreatedAt(item.createdAtMs)}</td>
                </tr>
              ))}

              {Array.from({ length: emptyRowCount }, (_, index) => (
                <tr key={`empty-${String(index)}`} aria-hidden className="border-b border-zinc-800">
                  <td className="px-4 py-3 sm:px-0" colSpan={5}>
                    {"\u00a0"}
                  </td>
                </tr>
              ))}
            </tbody>

            <tfoot>
              <tr>
                <td className="px-4 pt-3 sm:px-0" colSpan={5}>
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
  );
};
