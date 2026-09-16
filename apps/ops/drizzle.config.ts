import { config as loadEnv } from "dotenv";

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

loadEnv({ path: join(dirname(fileURLToPath(import.meta.url)), ".env") });

export default {
  schema: [
    "./src/login/repositories/nonce.schema.ts",
    "./src/jobs/job.schema.ts",
    "./src/standup/standup.schema.ts",
    "./src/poll/poll.schema.ts",
  ],
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
};
