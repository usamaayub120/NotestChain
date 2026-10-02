// Expo detects this file and delegates to the repository's shared flat config.
// Keeping it local prevents `expo lint` from attempting interactive setup.
import config from "../../eslint.config.mjs";

// ESLint resolves each block's `files` patterns against the directory of the
// config file it loaded, and it loads this one for everything under
// apps/mobile. So the shared config's "apps/mobile/**" patterns were being
// matched against paths already relative to apps/mobile, matched nothing, and
// silently dropped this workspace's React rules -- `pnpm lint` passed for a
// year without ever applying rules-of-hooks here. Strip the prefix so the
// mobile blocks apply. Patterns anchored with "**/" are base independent and
// are left alone.
export default config.map((block) =>
  Array.isArray(block?.files)
    ? { ...block, files: block.files.map((pattern) => pattern.replace(/^apps\/mobile\//, "")) }
    : block,
);
