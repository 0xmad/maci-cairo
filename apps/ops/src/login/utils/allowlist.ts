import { NEVER, string } from "zod";

const feltSchema = string().transform((value, ctx) => {
  const hex = value.trim().toLowerCase().replace(/^0x/u, "");

  if (hex.length === 0 || !/^[0-9a-f]+$/u.test(hex)) {
    ctx.addIssue({ code: "custom", message: `invalid hex: ${value}` });

    return NEVER;
  }

  return `0x${hex.padStart(64, "0")}`;
});

/**
 * Lowercases and left-pads a hex felt to 32 bytes.
 *
 * @throws If `value` is empty or contains non-hex characters.
 */
export function normalizeHex(value: string): string {
  return feltSchema.parse(value);
}

const allowlistSchema = string()
  .optional()
  .transform((raw): string[] => {
    if (raw === undefined || raw.trim().length === 0) {
      return [];
    }

    return raw.split(",").map((part) => normalizeHex(part));
  });

/** Comma-separated Operator addresses from env. */
export function parseAllowlist(raw: string | undefined): string[] {
  return allowlistSchema.parse(raw);
}
