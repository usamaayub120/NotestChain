# NotesChain — Solana Deployment & Authority Management Runbook

This is the operational counterpart to `ARCHITECTURE.md` §7–8 and
`IMPLEMENTATION_PLAN.md`'s Phase 3 "Toolchain environment log" — those
explain *what* the program does and *how it was built*; this explains *how
to run it in an actual environment* (devnet today, mainnet eventually) and
what to do when a key needs to move.

## 1. Two separate "authorities" — don't confuse them

There are **two independent keys** in this system, and they control
different things. Mixing them up is the most likely operational mistake:

| | Program upgrade authority | `platform_config.authority` |
|---|---|---|
| What it is | Solana's native BPF loader concept — whoever holds it can push new program bytecode to `declare_id!("exQD...")` | An on-chain field inside our own `PlatformConfig` account, set at `initialize_platform` |
| What it actually gates | Deploying/upgrading the program itself | **Only the `rotate_authority` instruction** (see below) |
| Set via | `solana program deploy` / `solana program set-upgrade-authority` | `initialize_platform`'s `authority` signer, later changed via `rotate_authority` |
| Held by (recommended) | A cold, rarely-used deploy key — ideally a multisig (Squads or similar) once on mainnet | The platform's day-to-day publisher keypair (`SOLANA_PUBLISHER_KEYPAIR_PATH`), or a separate ops key if you want publishing and admin-authority kept apart |

**Important, easily-missed fact**: `publish_publication`'s `authority`
account is a plain `Signer` with **no constraint tying it to
`platform_config.authority`** (see `PublishPublication` in `lib.rs`) — the
program does not check that the caller is "the" platform operator. In the
real system this doesn't matter in practice because only the worker
(`apps/worker/src/publishing/publishToChain.ts`) ever calls it, using the
one publisher keypair the platform controls. But it means the on-chain
program itself does not prevent a third party who knows the program ID from
calling `publish_publication` directly and creating their own `Publication`
account under this program, completely outside the platform's
moderation/outbox flow. The Phase 5 reconciliation sweep
(`apps/worker/src/reconciliation/reconcile.ts`) is the safety net for this:
any on-chain `Publication` account with no matching `PUBLISHED` row in
Postgres is flagged as `RECONCILIATION_ORPHAN_ON_CHAIN` in the audit log —
review those manually. Changing this would mean adding a
`constraint = authority.key() == platform_config.authority` to
`PublishPublication` in `lib.rs`, which is a program-code change requiring
a fresh deploy — deliberately not done as part of this documentation pass;
raise it as its own change if the risk is judged worth closing before
mainnet.

## 2. First deploy (devnet)

Prerequisites: local Rust/Solana/Anchor toolchain installed and
`anchor build` succeeding — see `IMPLEMENTATION_PLAN.md`'s Phase 3
"Toolchain environment log" for exact install steps and known blockers
(`anchor test` specifically has not been run successfully yet; that's
independent of deployment, which only needs `anchor build`'s output).

```bash
cd programs/decentralized_notes
solana config set --url https://api.devnet.solana.com
solana-keygen new --outfile ~/.config/solana/devnet-deploy.json   # one-time, cold-ish key
solana config set --keypair ~/.config/solana/devnet-deploy.json
solana airdrop 2                                                  # devnet only; rate-limited, retry later if it fails
anchor build
anchor deploy --provider.cluster devnet
```

`anchor deploy` prints the deployed program's address — it must match
`declare_id!(...)` in `lib.rs` and `SOLANA_PROGRAM_ID` in `.env`. If you
ever need a *different* program id (e.g. a from-scratch redeploy with a new
keypair), update all three of: `lib.rs`'s `declare_id!`, `Anchor.toml`, and
every `.env`/`.env.example` — see the note in
`IMPLEMENTATION_PLAN.md` Phase 3 about the placeholder-id mistake that
caused this exact triple-update requirement.

## 3. Publisher keypair — generation, storage, rotation

The publisher keypair is what the **worker** signs `publish_publication`
transactions with. It is deliberately not the same concept as the deploy
key above — treat it as a hot, frequently-used operational key, not a cold
key.

**Generate** (do this once per environment — devnet, staging, mainnet each
get their own):

```bash
solana-keygen new --outfile ./publisher-devnet.json --no-bip39-passphrase
```

**Fund it** (it pays rent + fees for every `publish_publication` call):

```bash
solana airdrop 2 --keypair ./publisher-devnet.json --url devnet   # devnet only
# mainnet: transfer real SOL from a funded wallet instead
```

**Deploy it to the running environment** — per `keypair.ts`'s loader logic:
- **Production**: mount the JSON file and set `SOLANA_PUBLISHER_KEYPAIR_PATH`
  to its path. `SOLANA_PUBLISHER_KEYPAIR_JSON` is refused outright when
  `NODE_ENV=production` — this is enforced in code
  (`packages/blockchain-client/src/keypair.ts`), not just convention, so a
  misconfigured deploy fails loudly at worker startup instead of silently
  trusting an env var.
- **Local dev**: `SOLANA_PUBLISHER_KEYPAIR_JSON` (the raw secret-key array as
  a JSON string) is fine — see `.env.example`.

**Never**: commit the keypair file, log it, or pass it through any HTTP
request — see `README.md`'s Security notes for what's already enforced in
code.

**Rotating it** (e.g. suspected compromise, routine hygiene, or moving from
devnet to mainnet):
1. Generate a new keypair, fund it.
2. Update `SOLANA_PUBLISHER_KEYPAIR_PATH` (or the mounted secret file's
   contents) and restart the worker — it loads the keypair once at process
   start and caches it (`apps/worker/src/publishing/solanaClient.ts`), so a
   restart is required, a config reload is not enough.
3. The old keypair only ever had the ability to *submit* `publish_publication`
   calls — it holds no special on-chain authority by itself (see §1), so
   retiring it is just "stop using it, drain any remaining SOL." There is
   nothing on-chain to revoke.

## 4. `platform_config.authority` rotation

This is the field `rotate_authority` changes — it currently gates nothing
else (see §1's caveat). To rotate it:

```bash
pnpm exec tsx scripts/init-platform.ts   # only if platform_config doesn't exist yet — see below
```

There is no dedicated `rotate-authority.ts` script yet; the instruction
exists in the program (`programs/decentralized_notes/.../lib.rs`) but has
no operational tooling built around it because nothing in the current
system depends on `platform_config.authority` being anyone specific (per
§1). If a future feature starts gating something on it (e.g. restricting
who can call `publish_publication`), write a small script mirroring
`scripts/init-platform.ts`'s pattern:
`createProgram(connection, wallet).methods.rotateAuthority(newAuthorityPubkey).accounts({ authority: currentAuthorityKeypair.publicKey }).rpc()`,
signed by whoever currently holds `platform_config.authority` (i.e. whoever
ran `initialize_platform` last, or the most recent successful rotation).

## 5. Platform initialization

One-time per cluster, after the program is deployed (see
`scripts/init-platform.ts`'s own header comment):

```bash
SOLANA_RPC_HTTP_URL=https://api.devnet.solana.com \
SOLANA_PROGRAM_ID=<deployed program id> \
SOLANA_PUBLISHER_KEYPAIR_PATH=./publisher-devnet.json \
pnpm exec tsx scripts/init-platform.ts
```

It's idempotent — if `platform_config` already exists at the expected PDA,
it logs that and exits without error, so it's safe to re-run after a
partial failure.

## 6. Mainnet checklist (not yet done — this system has only run on devnet)

Before ever pointing `SOLANA_CLUSTER=mainnet-beta` at real money:
- [ ] Move the program's upgrade authority to a multisig (Squads or
      equivalent) — a single hot key should never hold mainnet upgrade
      authority.
- [ ] Decide whether to close program upgradability entirely
      (`solana program set-upgrade-authority --final`) once the program is
      considered stable — this is irreversible and matches the
      "immutability by omission" design philosophy already applied to the
      instruction set itself.
- [ ] Fund the mainnet publisher keypair from a real wallet (no faucet).
- [ ] Re-run `anchor test` successfully at least once in a real CI
      environment first — it has never passed in this project (see
      `IMPLEMENTATION_PLAN.md` Phase 3) — treat that as a hard blocker for
      mainnet, not just a nice-to-have.
- [ ] Point `SOLANA_RPC_HTTP_URL`/`SOLANA_RPC_WS_URL` at a paid, dedicated
      RPC provider — the public `api.mainnet-beta.solana.com` endpoint is
      rate-limited and not suitable for production traffic (already noted
      in `README.md`'s Docker deployment section).
- [ ] Decide on the `publish_publication` authority-gating question in §1
      before mainnet — an unauthenticated write path to a program holding
      real on-chain content is a materially different risk on mainnet than
      on devnet.
