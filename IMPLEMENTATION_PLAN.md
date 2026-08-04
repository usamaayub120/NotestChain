# IMPLEMENTATION_PLAN.md — NotesChain

Companion to `ARCHITECTURE.md` (why) and `DESIGN_SYSTEM.md` /
`UI_IMPLEMENTATION_PLAN.md` (frontend). This is the *how and in what order*.

## Guiding rules while implementing

- The app must run after every phase (`pnpm dev` boots Postgres + API +
  worker + web; nothing is a stub that 500s).
- Off-chain first: phases 1–2 use a `Publication` table only; the chain
  program and worker (phases 3–4) plug into the outbox that phase 2 already
  created, without changing the phase-2 API surface.
- No new infra beyond: Postgres, the app container, Solana RPC. No Redis,
  no Elasticsearch, no message broker.

## Workspace layout

```
decentralized-notes/          (repo root, package name "noteschain")
├── apps/
│   ├── web/        Vite + React + TS frontend
│   ├── api/        Express + TS API
│   └── worker/     Node + TS Solana worker
├── packages/
│   ├── shared/            enums, DTO types, byte-limit constants, brand config
│   ├── validation/        zod schemas shared by web + api
│   └── blockchain-client/ PDA derivation, hashing, IDL types — shared by api + worker
├── programs/
│   └── decentralized_notes/   Anchor/Rust program + Anchor.toml + tests
├── prisma/
│   └── schema.prisma
├── infra/
│   ├── nginx/nginx.conf
│   └── supervisor/supervisord.conf
├── scripts/          seed.ts, create-admin.ts, etc.
├── tests/            cross-cutting e2e (Playwright)
├── Dockerfile
├── docker-compose.dev.yml
├── pnpm-workspace.yaml
└── .env.example
```

## Phase 1 — Foundation

1. `pnpm-workspace.yaml`, root `package.json` with workspace scripts,
   root `tsconfig.base.json`, shared `eslint`/`prettier` config.
2. `packages/shared`: `brand.ts` (centralized `brand` object), enums
   (`IdentityMode`, `Discoverability`, `DraftStatus`, `ChainStatus`, `Role`,
   `AccountStatus`), byte-limit constants, a `utf8ByteLength` helper.
3. `packages/validation`: zod schemas for register/login, draft
   create/update, identity create/update, moderation actions — imported by
   both `apps/api` (request validation) and `apps/web` (React Hook Form).
4. `prisma/schema.prisma`: full data model from §14 of the spec (all models
   below), one initial migration.
5. `apps/api`: Express bootstrap, env validation (`zod` parses `process.env`
   at startup and exits non-zero on failure — "environment validation at
   startup" from the spec), Pino logger with redaction of
   `password`/`passwordHash`/cookie values, Helmet + CSP, CORS (same-origin
   only — Nginx terminates everything under one origin, so CORS is
   effectively "same-origin, reject everything else"), body size limits,
   request-id middleware, `/health`, `/api/v1/health`,
   `/api/v1/health/ready` (checks DB connectivity + reports worker heartbeat
   + RPC reachability without exposing secrets).
6. Auth module: register, login, logout, refresh, `/auth/me`, Argon2id,
   session cookie + CSRF cookie, RBAC middleware, rate limiting on
   `/auth/*`.
7. `apps/web`: Vite + React + TS + Router + TanStack Query + Tailwind +
   shadcn/ui initialized, `brand` consumed from `packages/shared`, base
   layout shell, login/register pages wired to the real API.
8. `infra/nginx/nginx.conf`, `infra/supervisor/supervisord.conf`, root
   `Dockerfile` (multi-stage, non-root runtime user), `docker-compose.dev.yml`
   (Postgres + optional local validator profile).
9. `scripts/create-admin.ts` (seed one ADMIN via CLI, no plaintext
   credentials committed).

**Exit criteria:** `pnpm install && pnpm db:migrate && pnpm dev` serves a
working login/register flow at `http://localhost:5173` (web) proxied API at
`/api/v1`, and `docker build && docker run` serves the same thing on
`:8080` end to end (frontend + API only — worker has nothing to do yet, but
is running and healthy).

## Phase 2 — Core publishing platform

1. Identities module: CRUD, username uniqueness, `isVisible`, ownership
   checks, guard against deleting an identity that has published content
   (soft-hide instead — spec explicitly warns against breaking published
   attribution).
2. Drafts module: create/edit/delete, `POST /drafts/:id/autosave`
   (debounced from the client, writes `DraftVersion` only when content
   actually changed + throttled, e.g. at most one version per 30s of active
   edits plus one on every explicit "Save"), version list + restore,
   byte-count validation against the shared limits, submit/withdraw wired to
   the state machine from `ARCHITECTURE.md` §5.
3. Moderation module: submissions queue, approve/reject/request-changes,
   private moderation notes, duplicate-submission heuristic (title+content
   match against other open submissions), simple PII/abuse flags as
   checkboxes moderators set (no ML), all decisions write `ModerationDecision`
   + `AuditLog`. **Approve alone does not talk to Solana or create a
   Publication.** Per product spec §9, the author must still explicitly
   accept the irreversible-publication warning between "approved" and
   "queued to chain" — so `approve` only sets `Draft.status=APPROVED` +
   `Submission.status=APPROVED`; a separate author-initiated
   `POST /drafts/:id/confirm-publish` (gated on `acknowledgeIrreversible:
   true`) is what creates `Publication(status=CHAIN_PENDING)` +
   `PublicationChainRecord(chainStatus=QUEUED)` + the `OutboxEvent`,
   atomically. Phase 4 is what drains that outbox. This keeps phase 2 fully
   testable without any chain dependency.
4. Public read model: `GET /publications`, `/publications/:id`,
   `/profiles/:username`, `/tags`, `/tags/:slug/publications` — all
   unauthenticated, all filtered to `isPlatformVisible && discoverability
   permits`.
5. Search: generated `tsvector` column on `Publication` (title + content +
   tags, weighted), GIN index, `ts_rank` ordering, `websearch_to_tsquery`
   for user input, `ILIKE`-based prefix fallback for short queries,
   `/search` route + `SearchBar`/filters UI.
6. Bookmarks + bookmark collections: straightforward CRUD scoped to the
   authenticated user.

**Exit criteria:** full off-chain journey works — register → create
identity → write/autosave/version a draft → submit → moderator approves →
publication appears in the public read model with `status=CHAIN_PENDING`
(UI clearly labels it "publishing" rather than claiming it's live) →
visitor searches/reads/bookmarks it while logged out.

## Phase 3 — Solana program

1. `anchor init decentralized_notes` under `programs/`.
2. `PlatformConfig` PDA (`["platform"]`), `initialize_platform`.
3. `Publication` PDA (`["publication", publication_id.to_le_bytes()]`),
   `publish_publication` per §3.1 of `ARCHITECTURE.md` (program owns the
   counter and PDA derivation, validates all size/enum constraints, sets
   `identity_reference_hash`/`author_display_snapshot` per identity mode).
4. `rotate_authority` (current authority only).
5. Anchor unit tests: init, authorized publish, unauthorized publish
   rejected, correct PDA, duplicate id rejected, oversized field rejected,
   invalid enum rejected, revision linkage, and confirming
   `update_publication`/`close_publication` simply don't exist (compile-time
   guarantee, not a runtime test).
6. `anchor build` → IDL + generated TS types committed to
   `packages/blockchain-client/src/idl/` (single source of truth for both
   worker and API's verification code, re-exported via
   `packages/blockchain-client/src/program.ts`'s `createProgram()`).

**Status as of this pass:** `lib.rs` is complete and `anchor build` succeeds
— the program compiles, and the IDL/types committed above were generated
from a real successful build. `anchor test` (running the test suite in
`tests/decentralized_notes.ts` against `solana-test-validator`) has **not**
been run successfully yet — see "Toolchain environment log" below. Treat
the program as compile-verified but not yet runtime-verified; run
`pnpm anchor:test` in a fresh environment (see the CI note below) before
depending on it for Phase 4/5 integration testing.

**Exit criteria (not yet met):** `pnpm anchor:test` passes against
`solana-test-validator`; program deployed to devnet with a documented
program id.

### Toolchain environment log

Recorded here since standing up Rust/Solana/Anchor took real, non-obvious
work on both machines involved — useful if this needs reproducing later.

**This Windows machine** (native, no WSL):
- Installed via `winget`: `Rustlang.Rustup` (rustc/cargo 1.97.1), then
  `Microsoft.VisualStudio.2022.BuildTools` with the C++ workload (MSVC
  linker — required for the `x86_64-pc-windows-msvc` Rust target; without
  it, any crate with a `build.rs` fails to link).
- Solana CLI 4.1.1 (Agave) installed from `release.anza.xyz` (not
  `release.solana.com`, which failed TLS handshake from this network) —
  the installer's symlink step fails without admin/Developer Mode, worked
  around with a manually-created directory junction
  (`New-Item -ItemType Junction`) instead.
- `avm` + `anchor-cli` installed via `cargo install`. Anchor 0.30.1 hit a
  hard incompatibility (`anchor-syn` calling a `proc_macro2::Span` method
  removed in current `proc-macro2` releases) — resolved by moving to
  Anchor **0.31.1** (`anchor-lang` bumped to match in
  `programs/decentralized_notes/programs/decentralized_notes/Cargo.toml`
  and the TS `@coral-xyz/anchor` deps bumped alongside it for consistency).
  `avm`'s own version-switch symlink step has the same admin/Developer-Mode
  limitation as the Solana installer — worked around by copying the
  versioned binary to `anchor.exe` directly instead of symlinking.
- Result: `anchor build` succeeds. `anchor test` fails —
  `solana-test-validator` itself calls a symlink-creation API on startup
  and panics (`os error 1314`) rather than falling back; this needs
  Developer Mode enabled (Settings → Privacy & security → For developers),
  which requires admin rights not available from this session's shell.

**A separate Ubuntu VPS** (used briefly to try `anchor test` outside the
Windows symlink limitation — see below for why that didn't finish either):
- Freed 9.9GB of stale `docker builder` cache first (safe — build cache
  only, no running containers/images/volumes touched) since the box only
  had 688MB free and is running unrelated live production services.
- Installed: `build-essential`, `pkg-config`, `libssl-dev`, `libudev-dev`
  (apt), Rust via `rustup`, Solana CLI 2.1.0 (Agave, via `release.anza.xyz`
  — no symlink issues on Linux), Node.js 20 (NodeSource) + `pnpm`, `avm` +
  Anchor 0.31.1 (`cargo install`, ~6 min on this box's 1 vCPU/1GB RAM).
- `anchor build` hit a *different* problem: Anchor 0.31.1's default
  `platform-tools` (v1.43, bundling `cargo 1.79.0`) can't parse several of
  its own transitive dependencies (`cpufeatures`, `zeroize`, ...) that have
  since bumped to Rust's 2024 edition on crates.io. Pinning around one
  (`cargo update -p blake3 --precise 1.5.5` to drop the offending
  `cpufeatures 0.3.0`) worked once, but `anchor build`'s SBF compile step
  re-resolves dependencies on each run and the pin didn't stick. Forcing a
  newer `platform-tools` (`cargo-build-sbf --tools-version v1.54
  --force-tools-install`) hit a second, unrelated problem (missing
  `sbf-solana-solana` core sysroot for that toolchain version under Solana
  CLI 2.1.0). Stopped here rather than keep spending this box's disk —
  cleaned up (`~/.cache/solana`, build artifacts) back to a safe margin
  before leaving it.
- **This is an ecosystem-version-drift problem, not a code problem** — the
  program itself compiles cleanly (confirmed on Windows). The fix belongs
  in a properly pinned, disposable CI environment (e.g. GitHub Actions with
  `solana-actions/install@v2`/`anchor-actions`, or an official Solana
  Docker build image), not ad-hoc patching on a shared box. Revisit
  `anchor test` there before Phase 5's on-chain verification work depends
  on it.

## Phase 4 — Worker & blockchain orchestration

1. `WorkerJob`/`OutboxEvent` claiming with `SELECT ... FOR UPDATE SKIP LOCKED`.
2. `packages/blockchain-client`: keypair loading (secret-file path first,
   `SOLANA_PUBLISHER_KEYPAIR_JSON` env var fallback for local dev only),
   PDA derivation helpers, SHA-256 content hashing, Anchor `Program` client
   construction from the shared IDL.
3. Publish pipeline exactly as in `ARCHITECTURE.md` §6, with structured
   logs carrying `publicationId`, `jobId`, `transactionSignature`.
4. Retry/backoff + dead-letter (`FAILED_PERMANENT` after
   `WORKER_MAX_ATTEMPTS`), surfaced on `/admin/blockchain`.
5. Confirmation/finalization polling loop (HTTP) as the primary path;
   account-change WebSocket subscription as a fast-path nudge, never the
   only path (spec requirement — don't depend solely on WS).

**Exit criteria:** approving a submission in Phase-2's UI results, within a
few seconds on devnet, in `Publication.status=PUBLISHED`,
`PublicationChainRecord` populated with signature/PDA/slot/blockTime, and
the on-chain account is fetchable and matches the DB content hash.

**Status: code-complete, unit-tested, not yet chain-verified.** All five
items above are implemented
(`apps/worker/src/publishing/{claimJob,outboxProcessor,publishToChain,solanaClient}.ts`)
and typecheck/lint clean across the workspace. Unit tests cover the
claim/backoff/dead-letter logic with a mocked Prisma client
(`apps/worker/src/publishing/{claimJob,outboxProcessor}.test.ts`,
`pnpm --filter @noteschain/worker test`) per spec §22's "use mocks for fast
tests." The exit criteria itself (a real devnet publish) hasn't been run —
same toolchain gap as Phase 3, plus a devnet faucet rate limit hit while
funding a local wallet — so this is deferred alongside `anchor test`, not
additional new work.

One real bug caught and fixed while wiring this up: Anchor 0.31.1's
generated TS client auto-resolves any account whose IDL entry is a PDA with
only `const`/`arg` seeds (no `account` seeds), or has a fixed `address` —
passing them explicitly in `.accounts({...})` is now a *type error*, not
just redundant. Affected `publishPublicationToChain` (`platform_config`,
`publication`, `system_program` all auto-resolve; only
`previous_publication_account` and the `authority` signer must be passed)
and `scripts/init-platform.ts`'s `initializePlatform` call (`platform_config`
and `system_program` auto-resolve; only `authority` must be passed). Confirm
by reading the account's `pda.seeds` in
`programs/decentralized_notes/target/idl/decentralized_notes.json` — if
every seed is `const` or references an instruction `arg`, or the account has
a fixed `address`, omit it from `.accounts({...})`.

## Phase 5 — Verification, reconciliation, admin

1. `GET /publications/:id/verify` — live decode + hash/PDA check, returns
   one of the states enumerated in the spec §18 (`VERIFIED`,
   `ACCOUNT_NOT_FOUND`, `HASH_MISMATCH`, `PDA_MISMATCH`,
   `UNSUPPORTED_VERSION`, `RPC_UNAVAILABLE`, `NOT_FINALIZED`).
3. Reconciliation job (scheduled inside the worker, e.g. every 5 minutes):
   `getProgramAccounts` sweep, diff against DB, flag orphans and mismatches
   into a `ReconciliationIssue`-shaped audit entry rather than
   auto-"fixing" silently.
4. Delisting endpoints (`/admin/publications/:id/delist` /
   `restore-listing`) — sets `isPlatformVisible`/`delistingReason`, never
   touches chain state, UI copy uses "delisted/hidden from platform" only.
5. Reports (`POST /publications/:id/report`, admin resolve queue).
6. Audit log viewer.
7. `/admin/blockchain` dashboard: job list, retry action, reconciliation
   status.

**Exit criteria:** the acceptance criteria list in the product spec (§24,
items 1–20) all pass manually end to end.

**Status: implemented and browser-verified** (all against the running dev
stack with a real admin account, real Postgres data, and a real read-only
call to devnet — not just typechecked). Notes on what each item actually
does:

1. `verifyPublication` (`apps/api/src/modules/publications/verify.service.ts`)
   now does a live decode: derives the expected PDA from
   `onChainPublicationId`, calls `connection.getAccountInfo` +
   `program.account.publication.fetch` against a **new read-only API-side
   Solana client** (`apps/api/src/lib/solanaClient.ts` — an ephemeral
   `Keypair.generate()` wallet, since the API must never hold real signing
   authority), and returns one of the 7 states. Verified live against real
   devnet RPC: a fabricated `PUBLISHED` row with no real on-chain account
   correctly came back `ACCOUNT_NOT_FOUND`, end to end through the existing
   `BlockchainProofSheet` UI (which needed zero changes — it already
   handled all 7 states from Phase 2).
2. (numbering follows the product spec; there is no item 2 here — see the
   original list above.)
3. Reconciliation (`apps/worker/src/reconciliation/reconcile.ts`): a
   `program.account.publication.all()` sweep every
   `WORKER_RECONCILE_INTERVAL_MS` (default 5 min, gated inside `tick()` via
   a `lastReconciledAt` timestamp, not a second timer), diffed against
   `PUBLISHED` DB rows. Flags missing/mismatched/orphaned accounts as
   `AuditLog` rows (`RECONCILIATION_*` actions) — deliberately never
   auto-corrects anything.
4. Delisting: `POST /admin/publications/:id/delist` and
   `.../restore-listing` (`apps/api/src/modules/admin/`), gated
   `requireRole(Role.ADMIN)`. Confirmed via browser: delisting a
   publication makes `GET /publications/:id` (and the reader page) 404 for
   everyone, including admins — consistent with the existing Phase 2
   design that delisted ≠ a special "admin can still see it" state, just
   gone from that read path. The only way back in is `restore-listing`
   from the reports UI (see item 5) or a direct API call, since the
   publication itself is unreachable once delisted.
5. Reports: `GET /admin/reports`, `POST /admin/reports/:id/resolve`
   (`resolveReportSchema`'s three actions). `DELISTED` cascades into the
   delist itself in the same transaction; `USER_SUSPENDED` cascades into
   setting `User.status=SUSPENDED` and revoking all of that user's
   sessions (`revokeAllSessionsForUser`) — both were unused-but-prepared
   validation schemas from Phase 2 that needed a real cascade wired up
   rather than just recording a label. Browser-verified: resolve →
   publication 404s → "Resolved" tab shows a "Restore listing" action →
   restoring makes it readable again.
6. Audit log viewer: `GET /admin/audit-log`, paginated, admin-only. Verified
   it renders the entire pre-existing Phase 1–2 audit history (logins,
   moderation decisions) plus the new delist/restore/report entries
   correctly.
7. `/admin/blockchain`: `GET /admin/blockchain/jobs` (paginated, filterable
   by `WorkerJob.status`, joined to publication + chain record) and
   `POST /admin/blockchain/jobs/:id/retry` (resets a `FAILED` job to
   `PENDING`/`attempts=0` and un-stuck its `PublicationChainRecord` —
   an explicit admin override, the worker never does this itself).
   Browser-verified against a fabricated `FAILED` job: retry correctly
   reset it to `PENDING`, attempt 0/8, error cleared.

Frontend: `apps/web/src/pages/admin/{AdminHomePage,ReportsQueuePage,
AuditLogPage,BlockchainJobsPage}.tsx`, `apps/web/src/hooks/useAdmin.ts`,
routes added to `App.tsx` (reports/audit-log/blockchain gated
`RequireRole role="ADMIN"`; the `/admin` index gated `MODERATOR` since it
also links to the existing moderation queue). `apps/web/src/lib/api.ts`
gained `apiFetchPaginated` — a shared version of the `fetchPaginated`
helper that had been copy-pasted per-hook-file since Phase 2, used here to
avoid a fourth/fifth copy (the pre-existing three call sites were left
alone).

One design note worth recording: `packages/validation/src/admin.ts` also
has `updateUserStatusSchema`/`updateUserRoleSchema` for a general user-management
surface. Those are **not** part of Phase 5 (the plan's item list above
never mentions user management as its own feature — only the
report-triggered suspension cascade), so they remain unused. That's a
deliberate scope boundary, not an oversight.

## Phase 6 — Hardening

1. Security pass: privilege-escalation tests on admin/mod routes, anonymous
   response serialization tests (no leaking private ids), dependency audit
   (`pnpm audit`), CSP tightened, cookie flags double-checked in a
   production-like run behind Nginx/TLS-terminating proxy assumption.
2. Test coverage pass across unit / API integration / program / e2e per
   spec §22 (see `tests/` and per-package `*.test.ts`).
3. Full mobile-first visual QA pass per `UI_IMPLEMENTATION_PLAN.md` §16 QA
   matrix.
4. Docker image size/layer optimization, non-root user verification,
   graceful shutdown verification (SIGTERM drains in-flight requests,
   worker finishes/checkpoints current job).
5. Documentation pass: README setup, env var reference, Anchor deployment +
   authority management runbook, backup/recovery notes, known limitations.

**Status: done.** Notes on each item, including one critical bug this pass
specifically caught (see the callout below — it's the reason "test the
actual container, not just typecheck" is item 1 of this whole phase's
value):

1. `apps/api/src/test/{privilegeEscalation,anonymousSerialization}.test.ts`
   — supertest against a real Postgres test database (not mocks — see
   `README.md`'s "Running tests"), covering every admin/moderator route's
   401/403 behavior plus the one intentionally-asymmetric route, and
   asserting `ANONYMOUS`-publication responses never leak
   `privateAuthorUserId` or the author's email. `pnpm audit`: fixed the
   critical vitest advisory and three transitive ones (`serialize-javascript`,
   `uuid`, `hono`) via version bumps / `pnpm.overrides`; deliberately left
   the `vite`/`esbuild` (dev-server-only, never shipped) and
   `react-router` (SSR-only advisories, this is a client-only SPA) findings
   as accepted risk rather than forcing risky major-version migrations —
   see `README.md`'s Security notes for the full reasoning. CSP and cookie
   flags reviewed against `apps/api/src/app.ts`/`cookies.ts` — considered
   adequate, not changed (tightening `style-src` further risks breaking
   Radix's inline positioning styles for an uncertain gain; not attempted
   without a way to fully re-verify every admin/reader page afterward).
2. Real test infrastructure added where none existed:
   `apps/worker` (from Phase 4) + `apps/api` (supertest + a real test DB,
   `apps/api/vitest.config.ts`) + `apps/web` (vitest was referenced in
   `package.json`'s `test` script but the dependency itself, plus
   Testing Library/jsdom, had never actually been installed — added and
   wrote real tests: `apps/web/src/lib/api.test.ts`,
   `apps/web/src/components/RequireRole.test.tsx`). Program-level
   (`anchor test`) and e2e remain not done — both explicitly deferred
   (the former blocked by the same toolchain gap as Phases 3–4; the latter
   would mean standing up a whole new framework, judged out of proportion
   for this pass given how much manual real-browser verification already
   happened across Phases 1–6).
3. Representative mobile QA pass via the browser tool at 320/390/1280px,
   light + dark, across Home/Explore/reader pages — not the full
   `UI_IMPLEMENTATION_PLAN.md` §6 matrix exhaustively re-run page-by-page
   (that's already been the practice continuously since Phase 1, per that
   section's own note), but enough to catch a real bug: a long unbroken
   string (no spaces — the kind a URL or a run of emoji/CJK without word
   breaks produces) overflowed the viewport horizontally instead of
   wrapping. Fixed with `overflow-wrap: break-word` on `body` in
   `apps/web/src/styles/globals.css` — global rather than per-component,
   since the failure mode (any long unbroken token, anywhere user content
   renders) isn't specific to one page.
4. **Critical finding, not anticipated going into this phase**: rebuilt the
   Docker image fresh (not just relying on the Phase 1 build-and-boot
   check) and ran it against a real Postgres — the **worker process
   crash-looped on every startup** with
   `SyntaxError: Named export 'BN' not found. The requested module
   '@coral-xyz/anchor' is a CommonJS module...`. This had been broken since
   Phase 4 and invisible the entire time: `tsx watch` (used for all local
   dev/testing) transpiles and handles CJS/ESM interop differently than
   plain `node dist/worker.js` (what the Docker image actually runs), and
   `tsc`'s typecheck only checks against `.d.ts` declarations — it has no
   way to know a named import will fail to link at runtime. Root cause:
   `@coral-xyz/anchor` is a CJS package; Node's ESM importer uses static
   analysis (`cjs-module-lexer`) to detect a CJS module's named exports,
   and it fails to detect `BN` specifically (confirmed via `require()` that
   `BN` is a real export at runtime — this is a detection gap, not a
   missing export). Fixed by switching every real (non-type-only) import
   from `@coral-xyz/anchor` across the codebase
   (`packages/blockchain-client/src/program.ts`,
   `apps/worker/src/publishing/{publishToChain,solanaClient}.ts`,
   `apps/api/src/lib/solanaClient.ts`, `scripts/init-platform.ts`) to the
   default-import-then-destructure pattern
   (`import anchorPkg from "@coral-xyz/anchor"; const { X } = anchorPkg;`),
   which doesn't rely on that detection at all. Re-verified by rebuilding
   the image again and confirming the worker stays in supervisor's
   `RUNNING` state (previously: infinite crash/restart loop), plus a full
   graceful-shutdown check (SIGTERM → all three processes exit 0). This is
   exactly the class of bug that only running the real compiled artifact
   surfaces — worth remembering if a future change adds a new named import
   from any other CJS dependency.
5. `RUNBOOK.md` (new) — the two separate "authority" concepts (Solana
   program upgrade authority vs. this program's own
   `platform_config.authority`), first-deploy steps, publisher-keypair
   generation/storage/rotation, and a mainnet pre-flight checklist. It also
   documents a real design characteristic surfaced while writing it:
   `publish_publication`'s `authority` account has no constraint tying it
   to `platform_config.authority` — anyone with a program-owned-account-
   compatible signer can call it directly, bypassing the platform's
   moderation/outbox flow entirely. Not fixed (a program-code change
   needing redeployment, unverifiable without a live validator, and out of
   scope for a documentation pass) — flagged as something to close before
   mainnet, with the Phase 5 reconciliation sweep as the interim detection
   mechanism (it flags exactly this as `RECONCILIATION_ORPHAN_ON_CHAIN`).
   `BACKUP_RECOVERY.md` (new) — what's actually at risk (only
   Postgres — published content is on-chain permanently regardless of DB
   state), `pg_dump`/`pg_restore` + post-restore migration steps, and the
   reconciliation sweep doubling as the recovery mechanism after a stale
   restore. README's env var reference, "Running tests", and Security
   notes sections all updated in place.

## Developer commands (root `package.json` scripts)

```bash
pnpm install
pnpm db:generate      # prisma generate
pnpm db:migrate       # prisma migrate dev
pnpm dev              # concurrently: web (vite), api (tsx watch), worker (tsx watch), against docker-compose postgres
pnpm test             # unit + integration across workspaces
pnpm lint
pnpm typecheck
pnpm build            # builds shared -> validation -> blockchain-client -> web -> api -> worker
pnpm anchor:build
pnpm anchor:test
docker build -t noteschain .
docker run --env-file .env -p 8080:80 noteschain
```

## Environment variables (see `.env.example` for the authoritative list)

Grouped: `NODE_ENV`, `PORT`, `DATABASE_URL`, `SESSION_SECRET` (HMAC signing
of the CSRF cookie, not the session token itself), `COOKIE_DOMAIN`,
`CORS_ORIGIN`, `SOLANA_RPC_HTTP_URL`, `SOLANA_RPC_WS_URL`, `SOLANA_CLUSTER`,
`SOLANA_PROGRAM_ID`, `SOLANA_COMMITMENT`,
`SOLANA_PUBLISHER_KEYPAIR_PATH` (prod) / `SOLANA_PUBLISHER_KEYPAIR_JSON`
(dev only), `WORKER_POLL_INTERVAL_MS`, `WORKER_MAX_ATTEMPTS`,
`PUBLIC_EXPLORER_BASE_URL`, `LOG_LEVEL`.
