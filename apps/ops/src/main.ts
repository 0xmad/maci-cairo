import { config as loadEnv } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { RpcProvider } from "starknet";

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { operatorNonces } from "./login/repositories/nonce.schema.js";
import { PostgresNonceRepository } from "./login/repositories/postgresNonce.repository.js";
import { LoginService } from "./login/services/login.service.js";
import { SessionService } from "./login/services/session.service.js";
import { WalletService } from "./login/services/wallet.service.js";
import { randomFeltNonce } from "./login/utils/feltNonce.js";
import { createServer } from "./server.js";
import { readOpsEnv } from "./utils/env.js";

loadEnv({ path: join(dirname(fileURLToPath(import.meta.url)), "../.env") });

const HOURS_MS = 8 * 60 * 60 * 1000;
const env = readOpsEnv(process.env);

const pool = new Pool({ connectionString: env.databaseUrl });
const db = drizzle(pool, { schema: { operatorNonces } });

await migrate(db, { migrationsFolder: join(dirname(fileURLToPath(import.meta.url)), "../drizzle") });

const provider = new RpcProvider({ nodeUrl: env.starknetRpcUrl });
const loginService = new LoginService({
  nonceRepository: new PostgresNonceRepository(db),
  sessionService: new SessionService({ secret: env.jwtSecret, ttlMs: HOURS_MS }),
  nowMs: (): number => Date.now(),
  randomNonce: randomFeltNonce,
  walletService: new WalletService({
    chainId: env.starknetChainId,
    verify: async (message, signature, address) => provider.verifyMessageInStarknet(message, signature, address),
  }),
  allowlist: env.allowlist,
});

await createServer({ loginService }, env.port, "0.0.0.0");
