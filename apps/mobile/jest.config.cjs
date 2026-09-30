/** @type {import("jest").Config} */
const config = {
  preset: "jest-expo",
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "plugins/**/*.ts",
    "!src/**/__tests__/**",
    "!plugins/**/__tests__/**",
    "!src/**/testFixtures.ts",
    "!src/test/**",
  ],
};

module.exports = config;
