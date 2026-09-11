import { config as loadEnv } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { declareClass, deployUnique, sncastField } from "maci-deploy/sncast";
import { Pool } from "pg";
import { RpcProvider } from "starknet";

import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { operatorNonces } from "./login/repositories/nonce.schema.js";
import { PostgresNonceRepository } from "./login/repositories/postgresNonce.repository.js";
import { LoginService } from "./login/services/login.service.js";
import { SessionService } from "./login/services/session.service.js";
import { WalletService } from "./login/services/wallet.service.js";
import { randomFeltNonce } from "./login/utils/feltNonce.js";
import { createServer } from "./server.js";
import { jobs, jobSteps, maciInstances } from "./standup/repositories/job.schema.js";
import { PostgresJobStore } from "./standup/repositories/postgresJob.store.js";
import { StandupService } from "./standup/standup.service.js";
import { readOpsEnv } from "./utils/env.js";

loadEnv({ path: join(dirname(fileURLToPath(import.meta.url)), "../.env") });

const HOURS_MS = 8 * 60 * 60 * 1000;
const env = readOpsEnv(process.env);

const pool = new Pool({ connectionString: env.databaseUrl });
const db = drizzle(pool, { schema: { operatorNonces, jobs, jobSteps, maciInstances } });

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
const standupService = new StandupService({
  store: new PostgresJobStore(db),
  sncast: { declareClass, deployUnique, field: sncastField },
  nowMs: (): number => Date.now(),
  randomId: (): string => randomUUID(),
});

await createServer({ loginService, standupService }, env.port, "0.0.0.0");
