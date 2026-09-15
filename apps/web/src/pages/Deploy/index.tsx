import { type JSX } from "react";
import { Link } from "react-router-dom";

import { StandUpIntentForm } from "./StandUpIntentForm.js";
import { useStandUpCatalog } from "./useStandUpCatalog.js";

export const DeployPage = (): JSX.Element => {
  const { catalog, error, signedIn, starting, discarding, running, incompleteStandUp, startStandUp, discardStandUp } =
    useStandUpCatalog();

  return (
    <section className="mx-auto w-full max-w-md space-y-5">
      <Link className="inline-block text-base text-zinc-400 hover:text-white" to="/">
        Back
      </Link>

      <h1 className="text-3xl font-semibold">MACI stand-up</h1>

      <p className="text-base leading-relaxed">
        Start a MACI from this console. Your wallet is only used to sign in; the server deploys it.
      </p>

      {signedIn ? (
        <div className="space-y-3">
          {error !== undefined ? <p className="text-base text-red-400">{error}</p> : null}

          {catalog !== undefined ? (
            <StandUpIntentForm
              catalog={catalog}
              discarding={discarding}
              incompleteStandUp={incompleteStandUp}
              running={running}
              starting={starting}
              onDiscard={discardStandUp}
              onStart={startStandUp}
            />
          ) : null}
        </div>
      ) : (
        <p className="text-base">Sign in as Operator to start MACI stand-up.</p>
      )}
    </section>
  );
};
