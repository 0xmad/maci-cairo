import { config as loadEnv } from "dotenv";

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

loadEnv({ path: join(dirname(fileURLToPath(import.meta.url)), ".env") });

export default {
  schema: ["./src/login/repositories/nonce.schema.ts", "./src/standup/repositories/job.schema.ts"],
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
};
