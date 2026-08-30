/* eslint-disable import/no-extraneous-dependencies -- Vitest is a circuits devDependency */

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 180_000,
    hookTimeout: 120_000,
    ...(process.env.CI === "true"
      ? {
          fileParallelism: false,
          maxWorkers: 1,
        }
      : {}),
  },
});
