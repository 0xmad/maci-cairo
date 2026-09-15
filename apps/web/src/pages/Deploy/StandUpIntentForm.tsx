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

      <Button disabled={starting || running} size="field" type="submit">
        Start MACI stand-up
      </Button>
    </form>
  );
};
