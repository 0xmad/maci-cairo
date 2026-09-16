import { zodResolver } from "@hookform/resolvers/zod";
import { type JSX } from "react";
import { useForm } from "react-hook-form";

import { Button, Field, FieldError, Input, Label } from "../../components/ui";
import { createPollIntentSchema, type CreatePollBody, type CreatePollIntent } from "../../services/ops";
import { startOfLocalDay, toDatetimeLocalValue } from "../../utils/datetimeLocal.js";

export interface CreatePollFormProps {
  starting: boolean;
  running: boolean;
  available: boolean;
  unavailableReason?: string;
  onStart: (intent: CreatePollBody) => Promise<void>;
}

const PACKED_BASE8 = "1";
const DAY_MS = 24 * 60 * 60 * 1000;

export const CreatePollForm = ({
  starting,
  running,
  available,
  unavailableReason,
  onStart,
}: CreatePollFormProps): JSX.Element => {
  const now = new Date();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CreatePollIntent, unknown, CreatePollBody>({
    resolver: zodResolver(createPollIntentSchema),
    defaultValues: {
      startDate: toDatetimeLocalValue(now),
      endDate: toDatetimeLocalValue(new Date(now.getTime() + DAY_MS)),
      pollPublicKey: PACKED_BASE8,
    },
  });
  const startDate = watch("startDate");
  const inFlight = starting || running;

  if (!available) {
    return <p className="text-base text-zinc-400">{unavailableReason}</p>;
  }

  return (
    <form
      className="space-y-4"
      onSubmit={handleSubmit((intent) => {
        onStart(intent).catch(() => undefined);
      })}
    >
      <Field>
        <Label>Start date</Label>

        <Input min={startOfLocalDay(now)} type="datetime-local" {...register("startDate")} />

        <FieldError>{errors.startDate?.message}</FieldError>
      </Field>

      <Field>
        <Label>End date</Label>

        <Input min={startDate} type="datetime-local" {...register("endDate")} />

        <FieldError>{errors.endDate?.message}</FieldError>
      </Field>

      <Field>
        <Label>Poll public key</Label>

        <Input {...register("pollPublicKey")} />

        <FieldError>{errors.pollPublicKey?.message}</FieldError>
      </Field>

      <Button className="w-full" disabled={inFlight} size="field" type="submit">
        Create Poll
      </Button>
    </form>
  );
};
