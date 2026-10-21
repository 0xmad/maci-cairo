import { config as loadEnv } from "dotenv";
import { Account, RpcProvider } from "starknet";

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { starknetRelayerAccount } from "./account/starknetRelayerAccount.js";
import { createServer } from "./server.js";
import { readRelayerEnv } from "./utils/env.js";

loadEnv({ path: join(dirname(fileURLToPath(import.meta.url)), "../.env") });

const env = readRelayerEnv(process.env);
const provider = new RpcProvider({ nodeUrl: env.starknetRpcUrl });
const account = new Account({
  provider,
  address: env.starknetAccountAddress,
  signer: env.starknetAccountPrivateKey,
});

await createServer(env.port, starknetRelayerAccount(account));
