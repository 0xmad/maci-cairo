import {
  boolean,
  literal,
  number,
  object,
  strictObject,
  string,
  tuple,
  union,
  type ZodType,
  type infer as ZodInfer,
  type input as ZodInput,
} from "zod";

import { isDatetimeLocalValue, startOfLocalDay, unixSecondsFromDatetimeLocal } from "../../utils/datetimeLocal.js";
import { pollPublicKeySchema } from "../../utils/pollPublicKey.js";

export const errorBodySchema = object({ error: string() });
export const nonceResponseSchema = strictObject({ nonce: string().min(1) });
export const operatorSessionSchema = strictObject({
  token: string().min(1),
  address: string().min(1),
});
export const sessionAddressSchema = strictObject({ address: string().min(1) });
export const startJobSchema = strictObject({ jobId: string().min(1) });
export const standUpCatalogSchema = strictObject({
  circuitProfiles: strictObject({
    id: string().min(1),
    maxSignups: number().int().positive(),
    maxVoteOptions: number().int().positive(),
  }).array(),
  policies: strictObject({ id: string().min(1) }).array(),
  assigners: strictObject({ id: string().min(1) }).array(),
});
const standUpChoiceFields = {
  circuitProfile: string().min(1),
  policy: string().min(1),
  assigner: string().min(1),
};
export const standUpBodySchema = strictObject({
  ...standUpChoiceFields,
  voteBalance: union([string().min(1), number().int()]).optional(),
});
const POSITIVE_INT_AMOUNT = "Constant amount must be a positive integer";
export const standUpIntentSchema = strictObject({
  ...standUpChoiceFields,
  voteBalance: number({ error: POSITIVE_INT_AMOUNT }).int({ error: POSITIVE_INT_AMOUNT }).positive({
    error: POSITIVE_INT_AMOUNT,
  }),
});
/** Only catalog choice today: `small` / Free for all / Constant vote balance. */
export const DEFAULT_CONSTANT_VOTE_BALANCE = 3;
export const SMALL_STAND_UP_BODY = {
  circuitProfile: "small",
  policy: "Free for all",
  assigner: "Constant vote balance",
  voteBalance: DEFAULT_CONSTANT_VOTE_BALANCE,
} as const;

const DATETIME_AND_TIME = "Must be a date and time";
const pollScheduleField = string({ error: DATETIME_AND_TIME })
  .min(1, { error: DATETIME_AND_TIME })
  .refine((value) => isDatetimeLocalValue(value) && !Number.isNaN(unixSecondsFromDatetimeLocal(value)), {
    error: DATETIME_AND_TIME,
  });

export const createPollIntentSchema = strictObject({
  startDate: pollScheduleField,
  endDate: pollScheduleField,
  pollPublicKey: pollPublicKeySchema,
})
  .superRefine((data, ctx) => {
    const todayStart = startOfLocalDay(new Date());

    if (data.startDate < todayStart) {
      ctx.addIssue({ code: "custom", message: "Start must not be before today", path: ["startDate"] });
    }

    if (data.endDate < data.startDate) {
      ctx.addIssue({ code: "custom", message: "End must not be before start", path: ["endDate"] });
    }
  })
  .transform((data) => ({
    startDate: unixSecondsFromDatetimeLocal(data.startDate),
    endDate: unixSecondsFromDatetimeLocal(data.endDate),
    pollPublicKey: data.pollPublicKey,
  }));
export const createPollBodySchema = strictObject({
  startDate: union([string().min(1), number().int()]),
  endDate: union([string().min(1), number().int()]),
  pollPublicKey: union([string().min(1), number().int()])
    .array()
    .length(2),
});

export const jobStepSchema = strictObject({
  seq: number(),
  kind: string().min(1),
  name: string().min(1),
});
export const jobStatusSchema = union([
  literal("running"),
  literal("succeeded"),
  literal("failed"),
  literal("interrupted"),
]);
export const jobSnapshotSchema = strictObject({
  id: string().min(1),
  kind: union([literal("standup"), literal("create_poll")]),
  status: jobStatusSchema,
  error: string().optional(),
  steps: jobStepSchema.array(),
});
export const jobResponseSchema = strictObject({
  job: jobSnapshotSchema.nullable(),
  incompleteStandUp: boolean(),
  currentMaci: string().min(1).nullable(),
});
export const maciNetworkSchema = union([literal("starknet_local"), literal("sepolia")]);
export const maciListItemSchema = strictObject({
  address: string().min(1),
  network: maciNetworkSchema,
  createdAtMs: number().int().nonnegative(),
});
export const maciInstanceSchema = strictObject({
  leanImt: string().min(1),
  checker: string().min(1),
  enforcer: string().min(1),
  assigner: string().min(1),
  pollClassHash: string().min(1),
  pollFactoryClassHash: string().min(1),
  maci: string().min(1),
  pollFactory: string().min(1),
  coordinator: string().min(1),
  deployer: string().min(1),
  network: maciNetworkSchema,
  circuitProfile: string().min(1),
  policy: string().min(1),
  voteBalanceAssigner: string().min(1),
});
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export function paginatedSchema<Item extends ZodType>(item: Item): ZodType<Paginated<ZodInfer<Item>>> {
  return strictObject({
    items: item.array(),
    total: number().int().nonnegative(),
    page: number().int().positive(),
    pageSize: number().int().positive(),
  });
}
export const maciListResponseSchema = paginatedSchema(maciListItemSchema);
export const pollListItemSchema = strictObject({
  address: string().min(1),
  pollId: string().min(1),
  startDate: string().min(1),
  endDate: string().min(1),
  pollPublicKey: tuple([string().min(1), string().min(1)]),
  createdAtMs: number().int().nonnegative(),
});
export const pollListResponseSchema = paginatedSchema(pollListItemSchema);
export const jobEventSchema = union([
  strictObject({ type: literal("step"), step: jobStepSchema }),
  strictObject({
    type: literal("completed"),
    status: union([literal("succeeded"), literal("failed"), literal("interrupted")]),
    error: string().optional(),
  }),
]);

export type StandUpBody = ZodInfer<typeof standUpBodySchema>;
export type StandUpIntent = ZodInfer<typeof standUpIntentSchema>;
export type CreatePollIntent = ZodInput<typeof createPollIntentSchema>;
export type CreatePollBody = ZodInfer<typeof createPollBodySchema>;
export type StandUpCatalog = ZodInfer<typeof standUpCatalogSchema>;
export type OperatorSession = ZodInfer<typeof operatorSessionSchema>;
export type JobStep = ZodInfer<typeof jobStepSchema>;
export type JobSnapshot = ZodInfer<typeof jobSnapshotSchema>;
export type MaciListItem = ZodInfer<typeof maciListItemSchema>;
export type MaciListPage = Paginated<MaciListItem>;
export type PollListItem = ZodInfer<typeof pollListItemSchema>;
export type PollListPage = Paginated<PollListItem>;
export type MaciInstance = ZodInfer<typeof maciInstanceSchema>;
export type JobEvent = ZodInfer<typeof jobEventSchema>;
