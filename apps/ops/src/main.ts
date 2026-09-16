import { config as loadEnv } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { declareClass, deployUnique, sncastField } from "maci-deploy/sncast";
import { Pool } from "pg";
import { RpcProvider } from "starknet";

import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { JobEvents } from "./jobs/job.events.js";
import { jobs, jobSteps } from "./jobs/job.schema.js";
import { PostgresJobStore } from "./jobs/postgresJob.store.js";
import { operatorNonces } from "./login/repositories/nonce.schema.js";
import { PostgresNonceRepository } from "./login/repositories/postgresNonce.repository.js";
import { LoginService } from "./login/services/login.service.js";
import { SessionService } from "./login/services/session.service.js";
import { WalletService } from "./login/services/wallet.service.js";
import { randomFeltNonce } from "./login/utils/feltNonce.js";
import { createPollJobs, polls } from "./poll/poll.schema.js";
import { PollService } from "./poll/poll.service.js";
import { PostgresPollStore } from "./poll/postgresPoll.store.js";
import { createServer } from "./server.js";
import { PostgresStandupStore } from "./standup/postgresStandup.store.js";
import { maciInstances, standupCheckpoints } from "./standup/standup.schema.js";
import { StandupService } from "./standup/standup.service.js";
import { readOpsEnv } from "./utils/env.js";

loadEnv({ path: join(dirname(fileURLToPath(import.meta.url)), "../.env") });

const HOURS_MS = 8 * 60 * 60 * 1000;
const env = readOpsEnv(process.env);

const pool = new Pool({ connectionString: env.databaseUrl });
const db = drizzle(pool, {
  schema: { operatorNonces, jobs, jobSteps, maciInstances, standupCheckpoints, createPollJobs, polls },
});

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
const sncast = { declareClass, deployUnique, field: sncastField };
const nowMs = (): number => Date.now();
const randomId = (): string => randomUUID();
const jobStore = new PostgresJobStore(db);
const standupStore = new PostgresStandupStore(db);
const pollStore = new PostgresPollStore(db);
const events = new JobEvents();
const standupService = new StandupService({
  jobs: jobStore,
  standup: standupStore,
  events,
  sncast,
  nowMs,
  randomId,
});
const pollService = new PollService({
  jobs: jobStore,
  polls: pollStore,
  standup: standupStore,
  events,
  sncast,
  nowMs,
  randomId,
});

await standupService.recoverInterrupted();

await createServer({ loginService, standupService, pollService, jobs: jobStore, events }, env.port, "0.0.0.0");
