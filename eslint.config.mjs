import { fileURLToPath } from "url";
import tseslint from "typescript-eslint";
import globals from "globals";
import fs from "fs";
import path from "path";
import { defineConfig, globalIgnores } from "@eslint/config-helpers";
import { FlatCompat } from "@eslint/eslintrc";
import { fixupConfigRules } from "@eslint/compat";
import prettier from "eslint-plugin-prettier";
import unusedImports from "eslint-plugin-unused-imports";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default defineConfig([
  globalIgnores([
    "target",
    ".snfoundry_cache/",
    "snfoundry_trace/",
    "coverage/",
    "profile/",
    "node_modules/",
    "circuits/circom/test/",
    "circuits/circom/main/",
    "**/build/",
  ]),
  {
    extends: fixupConfigRules(
      compat.extends(
        "airbnb-base",
        "prettier",
        "plugin:import/recommended",
        "plugin:@typescript-eslint/eslint-recommended",
        "plugin:@typescript-eslint/recommended",
        "plugin:@typescript-eslint/recommended-type-checked",
        "plugin:@typescript-eslint/strict",
        "plugin:@typescript-eslint/strict-type-checked",
        "plugin:@typescript-eslint/stylistic",
        "plugin:@typescript-eslint/stylistic-type-checked",
        "plugin:import/typescript",
      ),
    ),

    plugins: {
      prettier,
      "unused-imports": unusedImports,
    },

    settings: {
      "import/resolver": {
        typescript: {
          project: path.resolve(__dirname, "./tsconfig.json"),
        },
      },
    },

    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.mocha,
        ...globals.es2022,
      },
      sourceType: "module",
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 2022,
        ecmaFeatures: {
          classes: true,
          impliedStrict: true,
        },
        requireConfigFile: false,
        project: path.resolve(__dirname, "./tsconfig.json"),
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: process.env.NODE_ENV === "production",
    },
    rules: {
      "import/no-cycle": ["error"],
      "unused-imports/no-unused-imports": "error",
      "import/no-extraneous-dependencies": [
        "error",
        {
          devDependencies: ["**/*.test.ts", "**/__benchmarks__/**", "**/tests/**", "**/__tests__/**"],
        },
      ],
      "no-debugger": process.env.NODE_ENV === "production" ? "error" : "off",
      "no-console": "error",
      "no-underscore-dangle": "error",
      "no-redeclare": ["error", { builtinGlobals: true }],
      "import/order": [
        "error",
        {
          groups: ["external", "builtin", "internal", "type", "parent", "sibling", "index", "object"],
          alphabetize: {
            order: "asc",
            caseInsensitive: true,
          },
          warnOnUnassignedImports: true,
          "newlines-between": "always",
        },
      ],
      "prettier/prettier": ["error", JSON.parse(fs.readFileSync(path.resolve(__dirname, "./.prettierrc"), "utf8"))],
      "import/prefer-default-export": "off",
      "import/extensions": ["error", { json: "always" }],
      "class-methods-use-this": "off",
      "prefer-promise-reject-errors": "off",
      "max-classes-per-file": "off",
      "no-use-before-define": ["off"],
      "no-shadow": "off",
      curly: ["error", "all"],
      "no-return-await": "off",
      "@typescript-eslint/explicit-member-accessibility": ["error", { accessibility: "no-public" }],
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/prefer-nullish-coalescing": "off",
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/use-unknown-in-catch-callback-variable": "off",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/explicit-module-boundary-types": "error",
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "@typescript-eslint/no-use-before-define": ["error", { functions: false, classes: false }],
      "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: false }],
      "@typescript-eslint/no-shadow": [
        "error",
        {
          builtinGlobals: true,
          allow: [
            "location",
            "event",
            "history",
            "name",
            "status",
            "Option",
            "test",
            "describe",
            "expect",
            "it",
            "beforeAll",
            "afterAll",
            "beforeEach",
            "afterEach",
          ],
        },
      ],
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
    },
  },
]);
