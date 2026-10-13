import { config as loadEnv } from "dotenv";

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createServer } from "./server.js";
import { readRelayerEnv } from "./utils/env.js";

loadEnv({ path: join(dirname(fileURLToPath(import.meta.url)), "../.env") });

const env = readRelayerEnv(process.env);

await createServer(env.port);
