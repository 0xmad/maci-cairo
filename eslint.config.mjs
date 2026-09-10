import { fileURLToPath } from "url";
import tseslint from "typescript-eslint";
import globals from "globals";
import fs from "fs";
import path from "path";
import { defineConfig, globalIgnores } from "@eslint/config-helpers";
import { FlatCompat } from "@eslint/eslintrc";
import { fixupConfigRules } from "@eslint/compat";
import drizzle from "eslint-plugin-drizzle";
import prettier from "eslint-plugin-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import unusedImports from "eslint-plugin-unused-imports";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const prettierOptions = JSON.parse(fs.readFileSync(path.resolve(__dirname, "./.prettierrc"), "utf8"));
const isProduction = process.env.NODE_ENV === "production";

const typescriptExtends = [
  "plugin:@typescript-eslint/eslint-recommended",
  "plugin:@typescript-eslint/recommended",
  "plugin:@typescript-eslint/recommended-type-checked",
  "plugin:@typescript-eslint/strict",
  "plugin:@typescript-eslint/strict-type-checked",
  "plugin:@typescript-eslint/stylistic",
  "plugin:@typescript-eslint/stylistic-type-checked",
  "plugin:import/typescript",
];

const typescriptRules = {
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
  "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
};

const importOrderRule = [
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
];

const parserOptions = {
  ecmaVersion: 2022,
  ecmaFeatures: {
    classes: true,
    impliedStrict: true,
    jsx: true,
  },
  requireConfigFile: false,
  tsconfigRootDir: __dirname,
  projectService: {
    allowDefaultProject: ["*.mjs"],
  },
  noWarnOnMultipleProjects: true,
};

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
    ignores: ["apps/web/**"],
    extends: fixupConfigRules(
      compat.extends("airbnb-base", "prettier", "plugin:import/recommended", ...typescriptExtends),
    ),

    plugins: {
      prettier,
      "unused-imports": unusedImports,
    },

    settings: {
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
          noWarnOnMultipleProjects: true,
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
      parserOptions,
    },
    linterOptions: {
      reportUnusedDisableDirectives: isProduction,
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
      "no-debugger": isProduction ? "error" : "off",
      "no-console": "error",
      "no-underscore-dangle": "error",
      "no-redeclare": ["error", { builtinGlobals: true }],
      "import/order": importOrderRule,
      "prettier/prettier": ["error", prettierOptions],
      "import/prefer-default-export": "off",
      "import/extensions": ["error", { json: "always" }],
      "class-methods-use-this": "off",
      "prefer-promise-reject-errors": "off",
      "max-classes-per-file": "off",
      "no-use-before-define": ["off"],
      "no-shadow": "off",
      curly: ["error", "all"],
      "no-return-await": "off",
      ...typescriptRules,
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
    },
  },
  {
    files: ["apps/ops/**/*.ts"],
    plugins: {
      drizzle,
    },
    rules: {
      "drizzle/enforce-delete-with-where": "error",
      "drizzle/enforce-update-with-where": "error",
    },
  },
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    extends: fixupConfigRules(compat.extends("airbnb", "prettier", "plugin:import/recommended", ...typescriptExtends)),
    plugins: {
      prettier,
      "unused-imports": unusedImports,
      "react-hooks": reactHooks,
    },
    settings: {
      react: {
        version: "detect",
      },
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
          noWarnOnMultipleProjects: true,
          project: path.resolve(__dirname, "./apps/web/tsconfig.json"),
        },
        node: {
          extensions: [".ts", ".tsx", ".js", ".jsx"],
        },
      },
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2022,
      },
      sourceType: "module",
      parser: tseslint.parser,
      parserOptions,
    },
    linterOptions: {
      reportUnusedDisableDirectives: isProduction,
    },
    rules: {
      "react/jsx-filename-extension": ["error", { extensions: [".tsx", ".jsx", ".js"] }],
      "react/jsx-sort-props": [
        "error",
        {
          callbacksLast: true,
          shorthandFirst: true,
          ignoreCase: true,
          reservedFirst: true,
        },
      ],
      "react/sort-prop-types": ["error", { callbacksLast: true }],
      "react/react-in-jsx-scope": "off",
      "react/jsx-boolean-value": "error",
      "react/jsx-handler-names": "error",
      "react/prop-types": "off",
      "react/require-default-props": "off",
      "react/jsx-no-bind": "error",
      "react-hooks/rules-of-hooks": "error",
      "react/no-array-index-key": "warn",
      "jsx-a11y/no-static-element-interactions": "warn",
      "jsx-a11y/click-events-have-key-events": "warn",
      "jsx-a11y/anchor-is-valid": "warn",
      "react/jsx-props-no-spreading": "off",
      "react/forbid-prop-types": "off",
      "react/state-in-constructor": "off",
      "react/jsx-fragments": "off",
      "react/static-property-placement": ["off"],
      "react/jsx-newline": ["error", { prevent: false }],
      "react/function-component-definition": ["error", { namedComponents: ["arrow-function"] }],
      "jsx-a11y/label-has-associated-control": "off",
      "jsx-a11y/label-has-for": "off",
      "import/no-cycle": ["error"],
      "unused-imports/no-unused-imports": "error",
      "import/no-extraneous-dependencies": [
        "error",
        {
          devDependencies: ["**/*.test.ts", "**/*.test.tsx", "**/__tests__/**", "**/vite.config.ts"],
        },
      ],
      "no-debugger": isProduction ? "error" : "off",
      "no-console": isProduction ? "error" : "off",
      "no-underscore-dangle": "error",
      "no-redeclare": ["error", { builtinGlobals: true }],
      "import/order": importOrderRule,
      "prettier/prettier": ["error", prettierOptions],
      "import/prefer-default-export": "off",
      "import/extensions": ["error", "never"],
      "class-methods-use-this": "off",
      "prefer-promise-reject-errors": "off",
      "max-classes-per-file": "off",
      "no-use-before-define": ["off"],
      "no-shadow": "off",
      curly: ["error", "all"],
      "no-return-await": "off",
      ...typescriptRules,
      "@typescript-eslint/no-shadow": [
        "error",
        {
          builtinGlobals: true,
          allow: ["location", "event", "history", "name", "status", "History", "Selection", "Text", "Option", "screen"],
        },
      ],
    },
  },
]);
