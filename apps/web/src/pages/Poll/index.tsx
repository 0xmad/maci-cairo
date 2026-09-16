import { type JSX } from "react";
import { Link, useParams } from "react-router-dom";

import { CreatePollForm } from "./CreatePollForm.js";
import { useCreatePoll } from "./useCreatePoll.js";

function createPollUnavailableReason(
  running: boolean,
  incompleteStandUp: boolean,
  recordedMaci: boolean,
  hasAddress: boolean,
): string {
  if (running) {
    return "Create Poll is unavailable while a job is running.";
  }

  if (incompleteStandUp) {
    return "Create Poll is unavailable while an incomplete stand-up exists.";
  }

  if (!hasAddress) {
    return "Create Poll needs a MACI address.";
  }

  if (!recordedMaci) {
    return "Create Poll needs a recorded MACI.";
  }

  return "Create Poll is unavailable.";
}

export const PollPage = (): JSX.Element => {
  const { address } = useParams();
  const {
    signedIn,
    starting,
    running,
    incompleteStandUp,
    recordedMaci,
    error: jobError,
    startCreatePoll,
  } = useCreatePoll();
  const instancePath = address === undefined ? "/" : `/maci/${address}`;
  const canCreatePoll = signedIn && recordedMaci && address !== undefined && !incompleteStandUp && !running;
  const unavailableReason = createPollUnavailableReason(
    running,
    incompleteStandUp,
    recordedMaci,
    address !== undefined,
  );

  return (
    <section className="mx-auto w-full max-w-md space-y-5">
      <Link className="inline-block text-base text-zinc-400 hover:text-white" to={instancePath}>
        Back
      </Link>

      <h1 className="text-3xl font-semibold">Create Poll</h1>

      <p className="text-base leading-relaxed">
        Create a Poll on this MACI from this console. Your wallet is only used to sign in; the server submits it.
      </p>

      {signedIn ? (
        <div className="space-y-3">
          {jobError !== undefined ? <p className="text-base text-red-400">{jobError}</p> : null}

          <CreatePollForm
            available={canCreatePoll}
            running={running}
            starting={starting}
            unavailableReason={unavailableReason}
            onStart={startCreatePoll}
          />
        </div>
      ) : (
        <p className="text-base">Sign in as Operator to create a Poll.</p>
      )}
    </section>
  );
};
