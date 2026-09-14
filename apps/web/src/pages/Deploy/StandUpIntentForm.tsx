import { zodResolver } from "@hookform/resolvers/zod";
import { type JSX } from "react";
import { useForm } from "react-hook-form";

import {
  DEFAULT_CONSTANT_VOTE_BALANCE,
  standUpIntentSchema,
  type StandUpBody,
  type StandUpCatalog,
  type StandUpIntent,
} from "../../services/ops";

import styles from "./StandUpIntentForm.module.css";

function firstId(choices: { id: string }[]): string {
  return choices[0]?.id ?? "";
}

const fieldClass = "mt-1.5 block h-11 w-full rounded border border-zinc-600 bg-zinc-950 px-3 text-base leading-none";
const selectClass = `${styles.select} mt-1.5 block h-11 w-full rounded border border-zinc-600 bg-zinc-950 pl-3 text-base leading-none`;

export interface StandUpIntentFormProps {
  catalog: StandUpCatalog;
  starting: boolean;
  running: boolean;
  onStart: (intent: StandUpBody) => Promise<void>;
}

export const StandUpIntentForm = ({ catalog, starting, running, onStart }: StandUpIntentFormProps): JSX.Element => {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<StandUpIntent>({
    resolver: zodResolver(standUpIntentSchema),
    defaultValues: {
      circuitProfile: firstId(catalog.circuitProfiles),
      policy: firstId(catalog.policies),
      assigner: firstId(catalog.assigners),
      voteBalance: DEFAULT_CONSTANT_VOTE_BALANCE,
    },
  });
  const circuitProfile = watch("circuitProfile");
  const profile = catalog.circuitProfiles.find((item) => item.id === circuitProfile) ?? catalog.circuitProfiles[0];

  return (
    <form
      className="space-y-4"
      onSubmit={handleSubmit((intent) => {
        onStart(intent).catch(() => undefined);
      })}
    >
      <label className="block text-base">
        Circuit profile
        <select className={selectClass} {...register("circuitProfile")}>
          {catalog.circuitProfiles.map((item) => (
            <option key={item.id} value={item.id}>
              {item.id}
            </option>
          ))}
        </select>
      </label>

      <dl className="grid grid-cols-2 gap-3 text-base">
        <div>
          <dt className="text-zinc-400">Max Signups</dt>

          <dd>{profile.maxSignups}</dd>
        </div>

        <div>
          <dt className="text-zinc-400">Max vote options</dt>

          <dd>{profile.maxVoteOptions}</dd>
        </div>
      </dl>

      <label className="block text-base">
        Policy
        <select className={selectClass} {...register("policy")}>
          {catalog.policies.map((item) => (
            <option key={item.id} value={item.id}>
              {item.id}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-base">
        Vote balance assigner
        <select className={selectClass} {...register("assigner")}>
          {catalog.assigners.map((item) => (
            <option key={item.id} value={item.id}>
              {item.id}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-base">
        Constant amount
        <input className={fieldClass} {...register("voteBalance", { valueAsNumber: true })} />
      </label>

      {errors.voteBalance?.message !== undefined ? (
        <p className="text-base text-red-400" role="alert">
          {errors.voteBalance.message}
        </p>
      ) : null}

      <button
        className="rounded border border-zinc-600 px-4 py-2.5 text-base hover:bg-zinc-800 disabled:opacity-50"
        disabled={starting || running}
        type="submit"
      >
        Start MACI stand-up
      </button>
    </form>
  );
};
