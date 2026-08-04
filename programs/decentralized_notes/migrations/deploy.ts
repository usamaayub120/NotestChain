// Anchor migration entry point — `anchor migrate` runs this against the
// cluster configured in Anchor.toml's [provider]. For the MVP, platform
// initialization is done deliberately once, out of band (see
// scripts/init-platform.ts at the repo root, added in Phase 4), not as
// part of every deploy — so this stays a no-op placeholder.
module.exports = async function (provider) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const anchor = require("@coral-xyz/anchor");
  anchor.setProvider(provider);
};
