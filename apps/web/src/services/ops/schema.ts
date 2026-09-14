import { literal, number, object, strictObject, string, union, type ZodType, type infer as ZodInfer } from "zod";

export const errorBodySchema = object({ error: string() });
export const nonceResponseSchema = strictObject({ nonce: string().min(1) });
export const operatorSessionSchema = strictObject({
  token: string().min(1),
  address: string().min(1),
});
export const sessionAddressSchema = strictObject({ address: string().min(1) });
export const startStandUpSchema = strictObject({ jobId: string().min(1) });
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
export const jobStepSchema = strictObject({
  seq: number(),
  kind: string().min(1),
  name: string().min(1),
});
export const jobStatusSchema = union([literal("running"), literal("succeeded"), literal("failed")]);
export const jobSnapshotSchema = strictObject({
  id: string().min(1),
  kind: literal("standup"),
  status: jobStatusSchema,
  error: string().optional(),
  steps: jobStepSchema.array(),
});
export const jobResponseSchema = strictObject({ job: jobSnapshotSchema.nullable() });
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
export const jobEventSchema = union([
  strictObject({ type: literal("step"), step: jobStepSchema }),
  strictObject({
    type: literal("completed"),
    status: union([literal("succeeded"), literal("failed")]),
    error: string().optional(),
  }),
]);

export type StandUpBody = ZodInfer<typeof standUpBodySchema>;
export type StandUpIntent = ZodInfer<typeof standUpIntentSchema>;
export type StandUpCatalog = ZodInfer<typeof standUpCatalogSchema>;
export type OperatorSession = ZodInfer<typeof operatorSessionSchema>;
export type JobStep = ZodInfer<typeof jobStepSchema>;
export type JobSnapshot = ZodInfer<typeof jobSnapshotSchema>;
export type MaciListItem = ZodInfer<typeof maciListItemSchema>;
export type MaciListPage = Paginated<MaciListItem>;
export type MaciInstance = ZodInfer<typeof maciInstanceSchema>;
export type JobEvent = ZodInfer<typeof jobEventSchema>;
