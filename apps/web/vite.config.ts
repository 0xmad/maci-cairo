import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

import { fileURLToPath } from "node:url";

const tongoStub = fileURLToPath(new URL("./src/stubs/tongo.ts", import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@fatsolutions/tongo-sdk": tongoStub,
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/__tests__/**", "src/main.tsx", "src/stubs/**", "src/vite-env.d.ts"],
    },
    server: {
      deps: {
        inline: ["starkzap"],
      },
    },
  },
});
