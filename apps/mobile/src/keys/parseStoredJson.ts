import { type ZodType } from "zod";

export const parseStoredJson = <T>(raw: string, schema: ZodType<T>, invalidMessage: string): T => {
  let json: unknown;

  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error(invalidMessage);
  }

  const parsed = schema.safeParse(json);

  if (!parsed.success) {
    throw new Error(invalidMessage);
  }

  return parsed.data;
};
