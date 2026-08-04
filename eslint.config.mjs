import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/.turbo/**", "programs/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  // Node (API, worker, scripts, shared packages)
  {
    files: ["apps/api/**/*.ts", "apps/worker/**/*.ts", "packages/**/*.ts", "scripts/**/*.ts"],
    languageOptions: {
      globals: globals.node,
    },
  },
  // Web app (React)
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
  {
    files: ["**/*.config.{js,ts,mjs}", "**/vite.config.ts"],
    languageOptions: { globals: globals.node },
  },
);
