import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

import { fileURLToPath } from "node:url";

const tongoStub = fileURLToPath(new URL("./src/stubs/tongo.ts", import.meta.url));

const devProxies = {
  "/starknet-rpc": {
    target: "http://127.0.0.1:5050",
    changeOrigin: true,
    rewrite: (path: string): string => path.replace(/^\/starknet-rpc/u, "") || "/",
  },
  "/ops": {
    target: "http://127.0.0.1:8787",
    changeOrigin: true,
    rewrite: (path: string): string => path.replace(/^\/ops/u, "") || "/",
  },
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@fatsolutions/tongo-sdk": tongoStub,
    },
  },
  server: {
    proxy: devProxies,
  },
  preview: {
    proxy: devProxies,
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
