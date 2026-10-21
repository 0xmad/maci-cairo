import { coerce, object, string } from "zod";

const tcpPortSchema = coerce.number().int().gte(1).lte(65535);
const accountFeltSchema = string().regex(/^(?:0x)?[0-9a-fA-F]+$/u);

function required(name: string) {
  return string({ error: `missing ${name}` }).min(1, { error: `missing ${name}` });
}

const relayerEnvSchema = object({
  STARKNET_RPC_URL: required("STARKNET_RPC_URL"),
  STARKNET_ACCOUNT_ADDRESS: accountFeltSchema,
  STARKNET_ACCOUNT_PRIVATE_KEY: accountFeltSchema,
});

export interface RelayerEnv {
  port: number;
  starknetRpcUrl: string;
  starknetAccountAddress: string;
  starknetAccountPrivateKey: string;
}

function readPort(rawPort: string | undefined): number {
  if (rawPort === undefined || rawPort.length === 0) {
    return 8788;
  }

  const parsed = tcpPortSchema.safeParse(rawPort);

  if (!parsed.success) {
    throw new Error("invalid PORT");
  }

  return parsed.data;
}

function portFrom(env: unknown): string | undefined {
  if (typeof env !== "object" || env === null || !("PORT" in env)) {
    return undefined;
  }

  return typeof env.PORT === "string" ? env.PORT : undefined;
}

/** Process env for the Relayer HTTP server and its Starknet account. */
export function readRelayerEnv(env: unknown): RelayerEnv {
  const port = readPort(portFrom(env));

  const parsed = relayerEnvSchema.safeParse(env);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];

    if (issue.message.startsWith("missing ")) {
      throw new Error(issue.message);
    }

    const field = issue.path[0];

    if (field === "STARKNET_ACCOUNT_ADDRESS" || field === "STARKNET_ACCOUNT_PRIVATE_KEY") {
      throw new Error(`invalid ${field}`);
    }

    throw new Error("missing STARKNET_RPC_URL");
  }

  return {
    port,
    starknetRpcUrl: parsed.data.STARKNET_RPC_URL,
    starknetAccountAddress: parsed.data.STARKNET_ACCOUNT_ADDRESS,
    starknetAccountPrivateKey: parsed.data.STARKNET_ACCOUNT_PRIVATE_KEY,
  };
}
