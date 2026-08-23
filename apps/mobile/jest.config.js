/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  collectCoverageFrom: ["src/lib/**/*.ts"],
  // Metro resolves the "@/*" -> "./*" tsconfig path alias at bundle time;
  // Jest needs the same mapping done explicitly since it doesn't read tsconfig paths.
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  // jest-expo's default pattern breaks under pnpm: it nests every package one
  // level deeper (node_modules/.pnpm/<pkg>/node_modules/<pkg>), so the
  // negative lookahead matches ".pnpm" at the first "node_modules/" segment
  // before it ever reaches the real package name, and Flow-typed RN source
  // gets left untransformed. Allow-listing ".pnpm" itself at that segment
  // lets the lookahead fall through to the real package name one level down.
  transformIgnorePatterns: [
    "node_modules/(?!\\.pnpm|((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg)",
    "node_modules/react-native-reanimated/plugin/",
  ],
};
