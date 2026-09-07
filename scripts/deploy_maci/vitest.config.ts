/* eslint-disable import/no-extraneous-dependencies -- Vitest is a maci-deploy devDependency */

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/deploy.ts"],
    },
  },
});
