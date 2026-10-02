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
  // Mobile app (Expo / React Native)
  //
  // These rules never actually ran here until the Expo SDK 57 upgrade: ESLint
  // loads apps/mobile/eslint.config.mjs for this workspace and resolves
  // `files` against that file's directory, so "apps/mobile/**" matched
  // nothing. That shim now strips the prefix -- see the comment in it.
  {
    files: ["apps/mobile/**/*.{ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser, __DEV__: "readonly" },
    },
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Switching the rules on surfaced a backlog these two flag across
      // screens that load or derive state on mount. None is a bug -- each
      // costs one extra render -- and unpicking them means reshaping data
      // flow on screens that have had no device testing, so they are a
      // visible backlog rather than a merge blocker. rules-of-hooks stays an
      // error: it is what caught the reader crash this upgrade exposed.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
    },
  },
  {
    files: ["**/*.config.{js,ts,mjs}", "**/vite.config.ts"],
    languageOptions: { globals: globals.node },
  },
);
