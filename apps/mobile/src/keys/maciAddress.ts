import { NEVER, string } from "zod";

const STARKNET_ADDRESS_HEX_LENGTH = 64;
const MAX_FELT = 2n ** 251n - 1n;

const configuredMaciAddressSchema = string()
  .trim()
  .regex(/^0x[0-9a-fA-F]{1,64}$/u)
  .transform((value, ctx): string => {
    const parsed = BigInt(value);

    if (parsed === 0n || parsed > MAX_FELT) {
      ctx.addIssue({ code: "custom", message: "Invalid MACI address" });

      return NEVER;
    }

    return `0x${parsed.toString(16).padStart(STARKNET_ADDRESS_HEX_LENGTH, "0")}`;
  });

export const readConfiguredMaciAddress = (raw: string | undefined): string | null => {
  const parsed = configuredMaciAddressSchema.safeParse(raw);

  return parsed.success ? parsed.data : null;
};

export const formatMaciAddressPreview = (address: string): string => `${address.slice(0, 6)}…${address.slice(-4)}`;

const expoPublicMaciAddress = (): string | undefined => {
  const value: unknown = process.env.EXPO_PUBLIC_MACI_ADDRESS;

  return typeof value === "string" ? value : undefined;
};

export const configuredMaciAddress = (): string | null => readConfiguredMaciAddress(expoPublicMaciAddress());
