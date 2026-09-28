/** @type {import("jest").Config} */
const config = {
  preset: "jest-expo",
  collectCoverageFrom: ["src/**/*.{ts,tsx}", "!src/**/__tests__/**", "!src/**/testFixtures.ts", "!src/test/**"],
};

module.exports = config;
