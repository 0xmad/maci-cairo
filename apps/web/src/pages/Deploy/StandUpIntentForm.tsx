import { zodResolver } from "@hookform/resolvers/zod";
import { type JSX } from "react";
import { useForm } from "react-hook-form";

import { Button, Field, FieldError, Input, Label, Select } from "../../components/ui";
import {
  DEFAULT_CONSTANT_VOTE_BALANCE,
  standUpIntentSchema,
  type StandUpBody,
  type StandUpCatalog,
  type StandUpIntent,
} from "../../services/ops";

function firstId(choices: { id: string }[]): string {
  return choices[0]?.id ?? "";
}

export interface StandUpIntentFormProps {
  catalog: StandUpCatalog;
  starting: boolean;
  running: boolean;
  discarding: boolean;
  incompleteStandUp: boolean;
  onStart: (intent: StandUpBody) => Promise<void>;
  onDiscard: () => Promise<void>;
}

export const StandUpIntentForm = ({
  catalog,
  starting,
  running,
  discarding,
  incompleteStandUp,
  onStart,
  onDiscard,
}: StandUpIntentFormProps): JSX.Element => {
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
  const inFlight = starting || running;
  const canRetry = incompleteStandUp && !inFlight;

  return (
    <form
      className="space-y-4"
      onSubmit={handleSubmit((intent) => {
        onStart(intent).catch(() => undefined);
      })}
    >
      <Field>
        <Label>Circuit profile</Label>

        <Select {...register("circuitProfile")}>
          {catalog.circuitProfiles.map((item) => (
            <option key={item.id} value={item.id}>
              {item.id}
            </option>
          ))}
        </Select>
      </Field>

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

      <Field>
        <Label>Policy</Label>

        <Select {...register("policy")}>
          {catalog.policies.map((item) => (
            <option key={item.id} value={item.id}>
              {item.id}
            </option>
          ))}
        </Select>
      </Field>

      <Field>
        <Label>Vote balance assigner</Label>

        <Select {...register("assigner")}>
          {catalog.assigners.map((item) => (
            <option key={item.id} value={item.id}>
              {item.id}
            </option>
          ))}
        </Select>
      </Field>

      <Field>
        <Label>Constant amount</Label>

        <Input {...register("voteBalance", { valueAsNumber: true })} />

        <FieldError>{errors.voteBalance?.message}</FieldError>
      </Field>

      {canRetry ? (
        <p className="text-base text-amber-200">
          This stand-up did not finish. Retry continues the same job. Discard starts a new graph.
        </p>
      ) : null}

      <div className="flex flex-col gap-4">
        <Button disabled={inFlight} size="field" type="submit">
          {canRetry ? "Retry MACI stand-up" : "Start MACI stand-up"}
        </Button>

        {canRetry ? (
          <Button
            disabled={discarding}
            size="field"
            type="button"
            onClick={() => {
              onDiscard().catch(() => undefined);
            }}
          >
            Discard incomplete stand-up
          </Button>
        ) : null}
      </div>
    </form>
  );
};
