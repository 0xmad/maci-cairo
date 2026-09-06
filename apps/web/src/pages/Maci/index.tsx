import { type JSX } from "react";

import { useMaciPage } from "./useMaciPage";

export const MaciPage = (): JSX.Element => {
  const { address, draft, handleChange, handleSubmit, hasMaci } = useMaciPage();

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">MACI</h1>

      <form className="flex flex-wrap gap-2" onSubmit={handleSubmit}>
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
          MACI address
          <input
            className="rounded border border-zinc-600 bg-zinc-950 px-2 py-1 font-mono"
            placeholder="0x…"
            value={draft}
            onChange={handleChange}
          />
        </label>

        <button className="self-end rounded border border-zinc-600 px-3 py-1 text-sm" type="submit">
          Open
        </button>
      </form>

      {hasMaci ? (
        <p className="font-mono break-all text-sm">{address}</p>
      ) : (
        <p>Paste a MACI address. No chain reads in this scaffold.</p>
      )}

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
