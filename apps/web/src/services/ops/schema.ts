import { literal, number, object, strictObject, string, union, type ZodType, type infer as ZodInfer } from "zod";

export const errorBodySchema = object({ error: string() });
export const nonceResponseSchema = strictObject({ nonce: string().min(1) });
export const operatorSessionSchema = strictObject({
  token: string().min(1),
  address: string().min(1),
});
export const sessionAddressSchema = strictObject({ address: string().min(1) });
export const startStandUpSchema = strictObject({ jobId: string().min(1) });
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

export type OperatorSession = ZodInfer<typeof operatorSessionSchema>;
export type JobStep = ZodInfer<typeof jobStepSchema>;
export type JobSnapshot = ZodInfer<typeof jobSnapshotSchema>;
export type MaciListItem = ZodInfer<typeof maciListItemSchema>;
export type MaciListPage = Paginated<MaciListItem>;
export type MaciInstance = ZodInfer<typeof maciInstanceSchema>;
export type JobEvent = ZodInfer<typeof jobEventSchema>;
