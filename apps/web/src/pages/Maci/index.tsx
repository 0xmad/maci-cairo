import { type JSX } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "../../components/ui";
import { useOpsJob } from "../../hooks/useOpsJob.js";
import { type MaciInstance } from "../../services/ops";
import { networkLabel } from "../../utils/networkLabel.js";
import { truncateAddress } from "../../utils/truncateAddress.js";

import { PollsTable } from "./PollsTable.js";
import { useMaciInstance } from "./useMaciInstance.js";
import { usePolls } from "./usePolls.js";

interface InstanceRow {
  label: string;
  value: string;
  address: boolean;
}

function instanceRows(instance: MaciInstance): InstanceRow[] {
  return [
    { label: "MACI", value: instance.maci, address: true },
    { label: "LeanIMT", value: instance.leanImt, address: true },
    { label: "Circuit profile", value: instance.circuitProfile, address: false },
    { label: "Policy", value: instance.policy, address: false },
    { label: "Vote balance assigner", value: instance.voteBalanceAssigner, address: false },
    { label: "Assigner", value: instance.assigner, address: true },
    { label: "Poll factory", value: instance.pollFactory, address: true },
    { label: "Poll class hash", value: instance.pollClassHash, address: true },
    { label: "Poll factory class hash", value: instance.pollFactoryClassHash, address: true },
    { label: "Coordinator", value: instance.coordinator, address: true },
    { label: "Deployer", value: instance.deployer, address: true },
    { label: "Network", value: networkLabel(instance.network), address: false },
  ];
}

export const MaciPage = (): JSX.Element => {
  const { address, signedIn, instance, error } = useMaciInstance();
  const { running, incompleteStandUp } = useOpsJob();
  const { items, page, pageCount, error: listError, nextPage, prevPage } = usePolls(address);
  const navigate = useNavigate();
  const canCreatePoll = signedIn && instance !== undefined && address !== undefined && !running && !incompleteStandUp;

  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold">MACI</h1>

      {!signedIn ? <p className="text-base">Sign in as Operator to view this MACI.</p> : null}

      {error !== undefined ? <p className="text-base text-red-400">{error}</p> : null}

      {instance !== undefined ? (
        <dl className="grid gap-2 text-base">
          {instanceRows(instance).map((row) => (
            <div key={row.label} className="grid grid-cols-[minmax(8rem,12rem)_1fr] gap-3">
              <dt className="text-zinc-400">{row.label}</dt>

              <dd className={row.address ? "font-mono break-all" : undefined} title={row.value}>
                {row.address ? truncateAddress(row.value) : row.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {canCreatePoll ? (
        <Button
          size="field"
          onClick={() => {
            navigate(`/maci/${address}/poll`);
          }}
        >
          Create Poll
        </Button>
      ) : null}

      {signedIn && instance !== undefined ? (
        <PollsTable
          error={listError}
          items={items}
          nextPage={nextPage}
          page={page}
          pageCount={pageCount}
          prevPage={prevPage}
        />
      ) : null}
    </section>
  );
};
