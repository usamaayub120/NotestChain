# NotesChain

> Thoughts worth keeping.

A public writing platform: private drafts, moderated publishing, and a
final, permanent, publicly-verifiable record on Solana. See
`ARCHITECTURE.md` for how it's built and why, `IMPLEMENTATION_PLAN.md` for
the phased build order, `DESIGN_SYSTEM.md` / `UI_IMPLEMENTATION_PLAN.md` /
`MOBILE_APP_STRATEGY.md` for the frontend, `RUNBOOK.md` for Solana
deployment/authority management, and `BACKUP_RECOVERY.md` for what to back
up and how to recover.

**Status:** Phases 1–5 are code-complete and verified (through the real
browser UI and, where a live validator isn't required, real devnet RPC
calls — not just typechecking): auth/roles, the full data model, drafts,
moderation, the Solana program (`anchor build` succeeds; `anchor test` has
not — see "Known limitations"), the worker's publish/reconciliation
pipeline, live on-chain verification, and the full admin surface
(delisting, reports, audit log, blockchain jobs). Phase 6 (hardening) is
in progress — see "Known limitations" below for exactly what's done vs.
outstanding.

## Quick start (local development)

```bash
pnpm install
cp .env.example .env               # edit SESSION_SECRET at minimum
pnpm dev:up                        # starts Postgres via docker-compose
pnpm db:migrate                    # applies prisma/migrations
pnpm db:seed                       # optional: admin/moderator/user + sample data
pnpm dev                           # builds packages/* once, then runs web+api+worker
```

- Web: http://localhost:5173 (Vite dev server, proxies `/api` to the API)
- API: http://localhost:3001 (`/health`, `/api/v1/health/ready`)

If port 5432 is already in use by another local Postgres install, change
the published port in `docker-compose.dev.yml` and `DATABASE_URL` together
(e.g. `"15432:5432"` / `...@localhost:15432/...`).

## Developer commands

```bash
pnpm install
pnpm db:generate      # prisma generate
pnpm db:migrate       # prisma migrate dev (local)
pnpm db:deploy        # prisma migrate deploy (CI/production)
pnpm db:seed          # seed dev data (never run against production)
pnpm create:admin     # ADMIN_EMAIL=... ADMIN_PASSWORD=... pnpm create:admin
pnpm dev              # run web + api + worker together
pnpm build            # build packages/*, then web, api, worker
pnpm test             # unit + integration tests across workspaces
pnpm lint
pnpm typecheck
docker build -t noteschain .
docker run --env-file .env -p 8080:80 noteschain
```

`pnpm dev` and `pnpm build` both build `packages/shared`,
`packages/validation`, and `packages/blockchain-client` to `dist/` first —
if you edit one of those packages, re-run `pnpm build:packages` (or just
`pnpm dev` again) to pick up the change; there's no cross-package watch
mode in the MVP.

## Environment variables

See `.env.example` for the full annotated list. Highlights:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string. External to the app container in production. |
| `SESSION_SECRET` | Must be set explicitly (32+ chars) in production; the API refuses to boot without it. |
| `COOKIE_DOMAIN`, `COOKIE_SECURE`, `CORS_ORIGIN` | Session cookie scope. `COOKIE_SECURE` is forced on automatically when `NODE_ENV=production` — cookies are `Secure`, so the production image expects TLS to terminate in front of it (a load balancer, Nginx-with-certs, etc.). Testing over plain `http://` in production mode will not persist the session cookie in a real browser (curl doesn't enforce this, which can be misleading during smoke tests). |
| `SOLANA_RPC_HTTP_URL` / `SOLANA_RPC_WS_URL` / `SOLANA_CLUSTER` / `SOLANA_PROGRAM_ID` / `SOLANA_COMMITMENT` | Chain connectivity, used by the API's read-only health check today and by the worker starting in Phase 4. |
| `SOLANA_PUBLISHER_KEYPAIR_PATH` | Production signing key path (mounted secret). Never set a real key via `SOLANA_PUBLISHER_KEYPAIR_JSON` outside local development — see `apps/worker`'s keypair loader, which refuses that fallback when `NODE_ENV=production`. |
| `WORKER_POLL_INTERVAL_MS`, `WORKER_MAX_ATTEMPTS`, `WORKER_RECONCILE_INTERVAL_MS` | Worker tuning, used starting in Phase 4. |

## Solana/Anchor toolchain (local)

`pnpm anchor:build` / `pnpm anchor:test` run against `programs/decentralized_notes/`.
This machine already has the toolchain installed (see
`IMPLEMENTATION_PLAN.md` Phase 3's "Toolchain environment log" for the full
story, including two unresolved environment issues):

- Rust via `rustup` (`~/.cargo/bin`), Visual Studio Build Tools (C++
  workload, for the MSVC linker).
- Solana CLI 4.1.1 at
  `~/.local/share/solana/install/active_release/solana-release/bin`.
- `avm` + Anchor CLI 0.31.1 at `~/.avm/bin` (the `anchor` command is a
  direct copy of the versioned binary, not a symlink — this account can't
  create symlinks without Developer Mode; see below).
- None of these are on PATH by default in a fresh shell in this
  environment — prepend the three bin directories above before running
  `anchor` commands.

`anchor build` works. `anchor test` does not yet (needs Windows Developer
Mode for `solana-test-validator`'s own symlink creation) — see the
Known limitations section.

## Database migrations

```bash
pnpm db:migrate --name <description>   # local dev — creates + applies a migration
pnpm db:deploy                          # production — applies existing migrations only
```

The schema lives at `prisma/schema.prisma` (repo root, per the required
workspace layout), not inside `apps/api`. All `prisma` CLI invocations run
from the repo root with `--schema prisma/schema.prisma`.

## Running tests

```bash
pnpm --filter @noteschain/worker test   # unit tests, mocked Prisma — no DB needed
pnpm --filter @noteschain/api test      # integration tests — needs a real Postgres test DB
```

The API's tests (`apps/api/src/test/`) exercise real HTTP requests against a
real `createApp()` instance and a real Postgres database — session cookies,
CSRF, and role checks are the actual production code paths, not mocks. They
need a dedicated database, created once:

```bash
psql -U postgres -h localhost -c "CREATE DATABASE noteschain_test;"
DATABASE_URL=postgresql://postgres:password@localhost:5432/noteschain_test \
  pnpm exec prisma migrate deploy --schema prisma/schema.prisma
```

`apps/api/src/test/setupEnv.ts` defaults `DATABASE_URL` to that same
`noteschain_test` connection string if the environment doesn't already set
one — override it if your local Postgres uses different credentials.
**Never point these tests at the dev or prod database** — each test file
calls `resetTestDb()` (`apps/api/src/test/helpers.ts`), which truncates
`User`, `Publication`, `Session`, and everything else the suite touches.

## Docker deployment

Single multi-stage image: installs the workspace, generates the Prisma
client, builds `packages/*` then `web`/`api`/`worker`, and assembles a slim
Alpine runtime running Nginx + the compiled API + the compiled worker under
Supervisor (`infra/supervisor/supervisord.conf`), with Nginx configured per
`infra/nginx/nginx.conf` (`/api/*` → Express, `/health` → app health,
`/*` → the React SPA).

```bash
docker build -t noteschain .
docker run --env-file .env -p 8080:80 noteschain
```

PostgreSQL and the Solana RPC endpoint are both external — never bundled
into this image. In production, point `DATABASE_URL` at a managed Postgres
instance and `SOLANA_RPC_HTTP_URL`/`SOLANA_RPC_WS_URL` at a real (ideally
dedicated, rate-limit-friendly) RPC provider rather than the public
`api.devnet.solana.com`/`api.mainnet-beta.solana.com` endpoints.

Verified: the image builds, all three processes (`nginx`, `api`, `worker`)
start and stay in a healthy running state (this specifically catches the
worker crash-loop bug described in "Known limitations" — a fresh build+run
is how it was found), register/login/session/CSRF work end to end through
the proxy, and `docker stop` drains all three processes cleanly (SIGTERM →
graceful shutdown, exit 0 for all three). Not yet exercised: a real Solana
publish against a live validator — see "Known limitations."

### CI and pulling the image on the VPS

`.github/workflows/ci.yml` runs on every push/PR: install, Prisma generate,
build the workspace packages, typecheck, lint, then the worker/API/web test
suites (the API's tests spin up a real ephemeral Postgres service
container in CI — same idea as the local `noteschain_test` DB, see "Running
tests" above). **It never deploys anything.** On a push to `main` only, a
second job builds this Dockerfile and pushes the image to GitHub Container
Registry, tagged `latest` and with the commit's short SHA — nothing beyond
that; pulling the new image onto a server is a deliberate manual step.

GHCR packages inherit the repo's visibility — for a private repo, the VPS
needs to authenticate before it can pull:

```bash
# One-time on the VPS — use a GitHub PAT with at least `read:packages` scope
echo "$GHCR_PAT" | docker login ghcr.io -u <your-github-username> --password-stdin

docker pull ghcr.io/<owner>/<repo>:latest   # owner/repo lowercased, matches the workflow
docker stop noteschain 2>/dev/null; docker rm noteschain 2>/dev/null
docker run -d --name noteschain --env-file .env -p 8080:80 \
  -v /path/to/publisher-keypair.json:/run/secrets/solana-publisher.json:ro \
  ghcr.io/<owner>/<repo>:latest
```

(If the repo/package is public instead, `docker login` isn't required to
pull.) The mounted keypair path must match whatever
`SOLANA_PUBLISHER_KEYPAIR_PATH` is set to in the VPS's `.env` — see
`RUNBOOK.md` §3 for generating/rotating that keypair.

### This project's actual production deployment

The generic instructions above describe the mechanism; this section
describes the specific box this app is actually running on, for whoever
next needs to redeploy it.

**This is a shared VPS running several unrelated projects** (containers
named `tradepsx-*`, `portfolio-*`, plus a `shared-postgres` container used
by more than one of them). Only ever touch the `noteschain` container, the
`noteschain.org`/`notes.usamaayub.com` nginx site files, and
`/opt/noteschain/*` — nothing else on the box is in scope, even if you
notice something that looks wrong.

**Connecting.** SSH access is defined in `~/.codex/ssh-config.toml` on the
operator's machine (key `my_vps`): host, port, username, and the path to
the private key. Read that file rather than hardcoding the host/user here,
since it's the source of truth and this doc would otherwise rot the moment
it changes. From a shell that has the key:

```bash
ssh -i <private_key_path from ssh-config.toml> <username>@<host>
```

**Layout on the VPS:**

- `/opt/noteschain/docker-compose.yml` — the compose file that actually
  defines the running `noteschain` container (image, port mapping
  `127.0.0.1:8090:80`, the keypair bind mount, and every runtime env var).
  Non-secret env vars are hardcoded directly in this file; the few secrets
  (`DATABASE_URL`, `SESSION_SECRET`, `TURNSTILE_SECRET_KEY`, `SMTP_PASSWORD`)
  are `${VAR}`-interpolated from a sibling `.env` file in the same
  directory. The container joins an external `shared-services` Docker
  network — that's how it reaches `shared-postgres`.
- `/opt/noteschain/.env` — the small secrets-only file referenced above.
  Never `cat` this over SSH into a session transcript; append/edit with a
  targeted `grep`/`printf`/`sed` instead of dumping it.
- `/home/codexops/noteschain/secrets/solana-publisher.json` — the
  publisher keypair, bind-mounted read-only into the container at
  `/run/secrets/solana-publisher.json`. This path is separate from
  `/opt/noteschain` and predates the compose migration; leave it where it
  is rather than "tidying" it into `/opt`.
- `/home/codexops/noteschain/.env` — a **stale, unused** leftover from
  before this was moved to docker-compose. Nothing reads it. Don't edit it
  expecting an effect; if it's ever in the way, confirm it's still unused
  before removing it.

**nginx + Let's Encrypt.** Both domains are configured in
`/etc/nginx/sites-available/` (symlinked into `sites-enabled/`), certs
issued via certbot's webroot method (`-w /var/www/certbot`, ECDSA keys) —
the same pattern used for every other site already on this box:

- `noteschain.org` — the live app. HTTP block 301s to HTTPS; the HTTPS
  block proxies to `http://127.0.0.1:8090` (the container's published
  port) and holds its own Let's Encrypt cert for `noteschain.org` +
  `www.noteschain.org`.
- `notes.usamaayub.com` — the old domain. Both its HTTP and HTTPS blocks
  now just `return 301 https://noteschain.org$request_uri;`. It keeps its
  own pre-existing cert only so the redirect itself can be served over TLS.

To renew or extend certs, use `certbot certonly --webroot -w
/var/www/certbot -d <domain>` matching the existing invocations — don't
switch to a different certbot plugin/method for this app, since it'd be
the only site on the box managed differently.

**Redeploying new code** (after CI has pushed a new image to GHCR):

```bash
docker pull ghcr.io/usamaayub120/notestchain:latest
cd /opt/noteschain && docker compose up -d   # recreates the container with the new image
```

`docker compose up -d` only recreates the container if the image or the
compose file's config changed — safe to run even when nothing's new.
**If the push included a new Prisma migration, apply it after the
container is back up** (the image doesn't run migrations on its own):

```bash
docker exec noteschain sh -c 'cd /app && node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma'
```

The worker logs `relation "X" does not exist` and fails its tick loop
every `WORKER_POLL_INTERVAL_MS` until this is run — that's the tell that a
migration was missed, not a sign anything else is wrong.

**Adding a new env var** (e.g. a future feature needs another secret or
config value): edit `/opt/noteschain/docker-compose.yml` directly for
non-secrets, or add a line to `/opt/noteschain/.env` plus a `${VAR}`
reference in the compose file for secrets — then `docker compose up -d` to
apply it. Remember the **Dockerfile itself must also know about any new
workspace package** under `packages/*` (each stage copies
`package.json`/`node_modules`/`dist` by explicit name, so a new package
that isn't added there breaks the CI Docker build with a
`--frozen-lockfile` install failure, not something else more obviously
about the missing package).

## Admin account creation

```bash
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a-strong-unique-password' pnpm create:admin
```

Idempotent — re-running promotes an existing user to `ADMIN` rather than
erroring. Never commit real credentials; `scripts/seed.ts` seed accounts
are dev-only and use a shared, obviously-fake password.

## Security notes

- Argon2id password hashing, HttpOnly+Secure+SameSite=Lax session cookie
  backed by a revocable DB session row, double-submit CSRF token, Helmet +
  a same-origin CSP, explicit CORS, per-route rate limiting, request size
  limits, structured logging with secret redaction, environment validation
  at startup, graceful shutdown. See `ARCHITECTURE.md` §3–4 for the
  reasoning behind each choice.
- The Solana publisher private key is never accepted from a request, never
  logged, and (per `packages/blockchain-client/src/keypair.ts`) the
  environment-variable fallback used for local dev is refused outright
  when `NODE_ENV=production`.
- Nothing that handles a request runs as root in the container — see the
  comment block at the bottom of `Dockerfile`.
- Privilege escalation is covered by an automated test
  (`apps/api/src/test/privilegeEscalation.test.ts`): every admin- and
  moderator-gated route is checked against unauthenticated, plain-USER,
  and (for admin routes) MODERATOR callers, asserting 401/403, plus the one
  intentionally-asymmetric route (`POST /publications/:id/report`, which
  requires auth but no specific role). Anonymous-publication serialization
  is covered separately
  (`apps/api/src/test/anonymousSerialization.test.ts`): asserts the API
  response for an `ANONYMOUS`-mode publication never contains
  `privateAuthorUserId`, the author's email, or any other de-anonymizing
  field, in both the single-publication and list responses.
- `pnpm audit` — run and triaged. **Fixed**: the vitest arbitrary-file-read
  advisory (bumped `apps/api`/`apps/worker` to vitest `^3.2.7`, and gave
  `apps/web` a real vitest/testing-library setup instead of an unresolvable
  ghost `test` script), plus `serialize-javascript`, `uuid`, and `hono`
  transitive advisories via `pnpm.overrides` in the root `package.json`
  (verified the `uuid` bump specifically by re-running a live devnet RPC
  call through `@solana/web3.js` → `jayson`'s request-id generation
  afterward — it still round-trips correctly). **Accepted as-is, not
  fixed**: `vite`/`esbuild` dev-server-only advisories (never shipped —
  both are devDependencies stripped from the production Docker image by
  the `build` stage's `pnpm install --prod`, and the dev server is never
  exposed to an untrusted network) and `react-router`'s SSR/framework-mode
  advisories (this is a client-only SPA — no server rendering, no data
  router `Form`/loader usage that the advisories target). Fixing the
  latter two would mean a Vite 6 and React Router 7 major-version bump
  respectively, both real migrations, for advisories that don't reach this
  app's actual usage — that trade isn't worth making blind. Re-run
  `pnpm audit` before considering either "resolved."

## Known limitations (current state, Phases 1–6)

- The `decentralized_notes` program is written and **compiles successfully**
  (`anchor build` — see `programs/decentralized_notes/`), and its IDL/TS
  types are committed to `packages/blockchain-client/src/idl/`. Its test
  suite (`anchor test`) has not been run successfully yet — blocked by a
  Windows Developer Mode requirement locally and an Anchor/crates.io
  version-drift issue on the VPS environment tried as an alternative. Full
  details and exact repro steps in `IMPLEMENTATION_PLAN.md`'s Phase 3
  "Toolchain environment log." Treat the program as compile-verified, not
  runtime-verified, until `anchor test` passes in a proper CI environment.
- The worker's publish pipeline (`apps/worker/src/publishing/`) and
  reconciliation sweep (`apps/worker/src/reconciliation/`) are fully
  written, typechecked, and unit-tested, but have **not been exercised
  against a live validator with a real deployed program** — same toolchain
  gap as above, plus devnet faucet rate-limiting hit while funding a local
  wallet. What *has* been verified live: `GET /publications/:id/verify`
  (`apps/api/src/modules/publications/verify.service.ts`) does a real
  read-only call to devnet RPC via a dedicated API-side Solana client
  (`apps/api/src/lib/solanaClient.ts`) and correctly returns
  `ACCOUNT_NOT_FOUND` for a publication with no matching on-chain account —
  confirmed via the browser through the existing `BlockchainProofSheet` UI.
  The write path (worker publishing something the verify endpoint then
  confirms) still needs a real deployed program to fully close the loop.
- Public browse/search deliberately shows `CHAIN_PENDING`/`CHAIN_SUBMITTED`
  publications too, not just `PUBLISHED` — a documented, deliberate Phase 2
  choice (see `publications.service.ts` and `search.service.ts`) so the
  platform is fully usable before the worker's chain-write path is
  runtime-verified. Every response carries an explicit `chain.status`; the
  UI never claims something is live before it is. This is intentionally
  unchanged in Phase 5 — search still isn't tightened to `PUBLISHED`-only,
  since that's tied to the same live-write-path verification gap above.
- Admin screens now exist and are browser-verified end to end: moderation
  queue (Phase 2), reports queue with delist/restore/suspend actions
  (`/admin/reports`), audit log viewer (`/admin/audit-log`), and the
  blockchain jobs dashboard with a manual retry action (`/admin/blockchain`).
  `packages/validation/src/admin.ts`'s `updateUserStatusSchema`/
  `updateUserRoleSchema` remain unused — general user management (beyond the
  report-triggered suspension cascade) was never part of the Phase 5 plan.
- The worker confirms/finalizes transactions via HTTP polling
  (`connection.confirmTransaction`), which is the spec's required primary
  path. The account-change WebSocket subscription described in the spec as
  an optional fast-path *nudge* (never the only path) is not implemented —
  purely a latency optimization, not a correctness gap, so it's deferred
  rather than blocking.
- **The Docker image's worker process was crash-looping on every single
  startup until this phase caught it** — a `SyntaxError` from a CJS/ESM
  named-import interop gap in `@coral-xyz/anchor` (`BN` specifically; see
  `IMPLEMENTATION_PLAN.md` Phase 6 item 4 for the full root-cause writeup).
  It was invisible through `tsx watch` (all local dev) and `tsc --noEmit`
  (typecheck only checks against declared types, not runtime module
  linkage) — only running the actual compiled output in the actual
  container surfaced it. Fixed now, and re-verified: fresh image rebuild,
  worker stays in supervisor's `RUNNING` state, and a full SIGTERM
  graceful-shutdown check still passes for all three processes. If a
  future change adds a new named import from `@coral-xyz/anchor` (or any
  other CJS dependency), prefer the default-import-then-destructure
  pattern already used throughout (`import pkg from "..."; const { X } =
  pkg;`) over a named import — see the comments at each import site.
- OpenAPI documentation and e2e tests are not done. Unit/integration tests
  now exist for all three apps (`apps/worker`, `apps/api`, `apps/web`) —
  see "Running tests" above — but there's no browser-automation e2e suite;
  standing one up was judged out of proportion given how much manual
  real-browser verification already happened across every phase.
- App icons are a placeholder SVG (`apps/web/public/favicon.svg`) — real
  raster PWA icons weren't done as part of this pass; same for self-hosting
  the intended typefaces (Bricolage Grotesque / Figtree / IBM Plex Mono),
  which currently fall back to the system font stack. Both are asset-
  creation tasks (icon export, font-file vendoring) rather than code
  changes, and neither blocks anything — deferred, not forgotten.
- The mobile QA pass covered representative breakpoints/pages/themes (see
  `IMPLEMENTATION_PLAN.md` Phase 6 item 3) rather than exhaustively
  re-running `UI_IMPLEMENTATION_PLAN.md` §6's full matrix page by page —
  that section notes it's meant to run continuously as each page is built,
  not as a single end-of-project pass.
- CSP's `style-src` still includes `'unsafe-inline'` — reviewed, not
  removed, since Radix UI's positioning relies on inline `style`
  attributes and tightening this without a way to re-test every page
  risked breaking real UI for an uncertain security gain. `pnpm audit`
  findings triaged, not all fixed — see Security notes above for exactly
  which and why.

## Suggested next phase

There isn't one queued — Phases 1–6 are all code-complete, and Phase 6 was
the last one in `IMPLEMENTATION_PLAN.md`. What's left is either (a) the
long-deferred toolchain work (`anchor test` passing, a real devnet
publish end to end — see `IMPLEMENTATION_PLAN.md` Phase 3's "Toolchain
environment log"), which needs a proper CI/Linux environment with
Developer Mode or root, not this Windows dev machine, or (b) genuinely new
feature work, which would need its own spec/plan rather than continuing an
existing phase list.
