import { coerce } from "zod";

const tcpPortSchema = coerce.number().int().gte(1).lte(65535);

export interface RelayerEnv {
  port: number;
}

/** Process env for the Relayer HTTP server. */
export function readRelayerEnv(env: NodeJS.ProcessEnv): RelayerEnv {
  const raw = env.PORT;

  if (raw === undefined || raw.length === 0) {
    return { port: 8788 };
  }

  const parsed = tcpPortSchema.safeParse(raw);

  if (!parsed.success) {
    throw new Error("invalid PORT");
  }

  return { port: parsed.data };
}
