import { type JSX } from "react";
import { Link } from "react-router-dom";

import { type Poll } from "../../services/ops";
import { formatCreatedAt, formatUnixSeconds } from "../../utils/formatCreatedAt.js";
import { serializePollPublicKey } from "../../utils/pollPublicKey.js";
import { truncateAddress } from "../../utils/truncateAddress.js";

import { usePoll } from "./usePoll.js";

interface PollRow {
  label: string;
  value: string;
  address: boolean;
}

function pollRows(poll: Poll, ballotCount?: string): PollRow[] {
  const rows: PollRow[] = [
    { label: "Poll", value: poll.address, address: true },
    { label: "Poll id", value: poll.pollId, address: false },
    { label: "MACI", value: poll.maci, address: true },
    { label: "Start", value: formatUnixSeconds(poll.startDate), address: false },
    { label: "End", value: formatUnixSeconds(poll.endDate), address: false },
    {
      label: "Poll public key",
      value: serializePollPublicKey(poll.pollPublicKey),
      address: false,
    },
    { label: "Created at", value: formatCreatedAt(poll.createdAtMs), address: false },
  ];

  if (ballotCount !== undefined) {
    rows.push({ label: "Ballot count", value: ballotCount, address: false });
  }

  return rows;
}

export const PollPage = (): JSX.Element => {
  const { maci, signedIn, poll, ballotCount, error } = usePoll();
  const backPath = maci === undefined ? "/" : `/maci/${maci}`;

  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <Link className="inline-block text-base text-zinc-400 hover:text-white" to={backPath}>
        Back
      </Link>

      <h1 className="text-2xl font-semibold">Poll</h1>

      {!signedIn ? <p className="text-base">Sign in as Operator to view this Poll.</p> : null}

      {error !== undefined ? <p className="text-base text-red-400">{error}</p> : null}

      {poll !== undefined ? (
        <dl className="grid gap-2 text-base">
          {pollRows(poll, ballotCount).map((row) => (
            <div key={row.label} className="grid grid-cols-[minmax(8rem,12rem)_1fr] gap-3">
              <dt className="text-zinc-400">{row.label}</dt>

              <dd className={row.address ? "font-mono break-all" : "break-all"} title={row.value}>
                {row.address ? truncateAddress(row.value) : row.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
};
