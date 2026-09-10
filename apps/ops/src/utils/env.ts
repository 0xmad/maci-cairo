import { coerce, object, string } from "zod";

import { parseAllowlist } from "../login/utils/allowlist.js";

function required(name: string) {
  return string({ error: `missing ${name}` }).min(1, { error: `missing ${name}` });
}

const tcpPortSchema = coerce.number().int().gte(1).lte(65535);

const opsEnvSchema = object({
  DATABASE_URL: required("DATABASE_URL"),
  JWT_SECRET: required("JWT_SECRET"),
  STARKNET_RPC_URL: required("STARKNET_RPC_URL"),
  STARKNET_CHAIN_ID: required("STARKNET_CHAIN_ID"),
  OPERATOR_ALLOWLIST: string().optional(),
  PORT: string()
    .optional()
    .transform((raw) => {
      const parsed = tcpPortSchema.safeParse(raw === undefined || raw.length === 0 ? "8787" : raw);

      return parsed.success ? parsed.data : 8787;
    }),
});

export interface OpsEnv {
  databaseUrl: string;
  jwtSecret: string;
  starknetRpcUrl: string;
  starknetChainId: string;
  allowlist: string[];
  port: number;
}

/** Process env for the ops HTTP server. */
export function readOpsEnv(env: NodeJS.ProcessEnv): OpsEnv {
  const parsed = opsEnvSchema.safeParse(env);

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0].message);
  }

  return {
    databaseUrl: parsed.data.DATABASE_URL,
    jwtSecret: parsed.data.JWT_SECRET,
    starknetRpcUrl: parsed.data.STARKNET_RPC_URL,
    starknetChainId: parsed.data.STARKNET_CHAIN_ID,
    allowlist: parseAllowlist(parsed.data.OPERATOR_ALLOWLIST),
    port: parsed.data.PORT,
  };
}
