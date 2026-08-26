# ARCHITECTURE.md — NotesChain

Status: living document, updated as implementation proceeds.

## 1. System shape

NotesChain is a **modular monolith** with one on-chain program:

```
┌─────────────────────────── one Docker container ───────────────────────────┐
│                                                                              │
│   Nginx  ──serves──▶  React static build (dist/)                           │
│     │                                                                       │
│     └──proxies /api──▶  Express API (apps/api)                             │
│                             ├─ auth        ├─ moderation                   │
│                             ├─ identities  ├─ publications (read model)    │
│                             ├─ drafts      ├─ search                       │
│                             ├─ bookmarks   ├─ admin / reports / audit      │
│                                                                              │
│   Background Worker (apps/worker) — separate Node process, same image     │
│     ├─ outbox claimer      ├─ confirmation/finalization tracker            │
│     ├─ Anchor tx builder   ├─ program-account indexer (WS + polling)       │
│     └─ reconciliation job                                                  │
│                                                                              │
│   Supervisor keeps: nginx, api, worker running, restarts on crash          │
└──────────────────────────────────────────────────────────────────────────────┘
                    │                                   │
                    ▼                                   ▼
        PostgreSQL (external, managed             Solana RPC (devnet initially,
        in prod / docker-compose in dev)          external, HTTP + WS)

                    ▲
                    │ deployed separately, not part of the container
        programs/decentralized_notes (Anchor/Rust program on Solana)
```

No microservices. Auth, drafts, moderation, search, bookmarks, profiles, reports,
and admin are all modules (routers + services) inside the one Express app,
sharing one Prisma client and one DB connection pool.

## 2. Source of truth boundaries

| Data | Source of truth | Notes |
|---|---|---|
| Draft content, versions, autosave | PostgreSQL | Never leaves the DB. Never on-chain. |
| Moderation decisions, notes, reports, audit log | PostgreSQL | Off-chain forever. |
| **Finalized publication content** (v1 publications) | **Solana account** | DB `Publication.content` is a cached copy for fast reads/search; it is rebuildable from chain. |
| **Finalized publication content** (v2 publications) | **PostgreSQL** | The chain holds `content_hash` + title + a 280-byte excerpt, not the body. Content is **verifiable against** the chain, no longer **rebuildable from** it. See §2.1. |
| User↔anonymous-publication linkage (legacy only — see §4a) | PostgreSQL | Never on-chain, used only for abuse handling. |
| Follow graph | PostgreSQL | `Follow` rows point `User → PublicIdentity`. Never on-chain, and never exposed as a member list — see §4a. |
| Search index | PostgreSQL `tsvector` | Rebuildable from `Publication.contentPlain` (the markup-stripped projection — the index must never see raw markdown, or `**bold**` becomes a search token). Those rows are rebuildable from chain only for v1; for v2 they depend on the Postgres backup. |

**Rule enforced everywhere in code:** a publication is not "done" because an RPC
call returned a transaction signature. It is only `PUBLISHED` after the worker
observes **finalized** commitment, fetches the account, and verifies PDA +
content hash. See §6.

### 2.1 Why v2 moved the body off-chain, and what that costs

v1 stored the whole note inside the Solana account. That is why the body was
capped at **600 bytes**: Solana's hard limit is 1232 bytes per transaction, and
title (100) + author display (50) + body all had to fit inside it alongside
signatures, account keys, and the blockhash. There was roughly 150 bytes of
headroom. No amount of tuning made long notes possible under that design, and
readers had asked for them.

v2 (`publish_publication_v2`, `PublicationV2`) commits
`sha256("noteschain/pub/v2" || len-prefixed title, excerpt, content)` and stores
title + a 280-byte excerpt. The body lives in Postgres.

**What is lost:** on-chain data availability. The chain can no longer prove the
digest is the hash of anything, and content is not reconstructible from chain
alone. Postgres is the source of truth for note text.

**What is kept:** the guarantee people actually rely on — an immutable,
publicly witnessed, slot-timestamped *commitment*. At that slot, under that
publication id, the platform authority committed to that digest, and nobody
(including us) can change it afterward. A reader given body B can check
`sha256_v2(title, excerpt, B)` against the chain and know those exact bytes
existed then and have not been substituted since.

**On the on-chain hash recomputation v1 did and v2 cannot:** it is worth being
precise about how much that was ever worth. `require_keys_eq!(authority,
platform.authority)` means only the platform key can publish at all, so the
recomputation never defended against a third party — it caught bugs in our own
worker. That role now belongs to the worker's pre-submit check
(`publishToChain.ts`) and to live verification on read (`verify.service.ts`),
neither of which ever read the account's stored body even under v1.

Three off-chain guards replace what the chain used to provide:
`Publication.contentBytes` cross-checked against the on-chain `content_length`;
a Postgres trigger making `content`/`title`/`excerpt`/`contentHash` immutable
once `status = PUBLISHED`; and **backups, which are now load-bearing rather
than a convenience** — see BACKUP_RECOVERY.md.

## 3. Resolved contradictions / decisions

The spec is internally consistent almost everywhere; a few points required a
concrete implementation choice. Recorded here so nobody re-derives them differently later.

### 3.1 Publication ID assignment (the one real race condition)

The spec suggests deriving the Publication PDA from `publication_id` supplied
by the client, with an on-chain `publication_counter` for bookkeeping. If the
**client** chooses the id (e.g. from a Postgres sequence) and the **program**
independently increments its own counter, the two can diverge, or two
concurrent submitters could pick the same id and race on the same PDA.

**Decision:** the program is the sole authority for `publication_id`.
`publish_publication` reads `platform_config.publication_counter`, uses that
value as the seed for the new PDA, creates the account, and increments the
counter — all in one instruction, so it's atomic with respect to that PDA.
The **worker** (client) must still pass the *expected* `publication_id` (Solana
requires all accounts, including ones being `init`ialized, to be named in the
transaction up front), fetched via `getAccountInfo` on the platform PDA
immediately before building the transaction. The program re-checks that the
supplied id still equals the live counter at execution time; if another
transaction landed first, this one fails harmlessly and the worker retries
with a freshly-read counter value. Because there is exactly one worker process
in the MVP, contention is rare, but the retry path is required regardless (a
worker restart mid-flight has the same effect as concurrency).

`Publication.onChainPublicationId` is therefore **nullable** until a
`PublicationChainRecord` is confirmed; it is only trusted once decoded back
out of the finalized account, never assumed from the client-side attempt.

### 3.2 Sessions: "refreshable" + "HTTP-only cookie" + "no localStorage tokens"

**Decision:** no JWT access/refresh pair. A single opaque, random
(32-byte) session token lives in an `HttpOnly`, `Secure`, `SameSite=Lax`
cookie, backed by a `Session` row in Postgres (sliding expiry, default 30
days idle timeout, 90 day absolute max). `POST /auth/refresh` extends and
rotates the token (old row revoked, new row issued) — this bounds the replay
window of a stolen cookie and gives us instant server-side revocation for
logout, suspension, and password change, which a stateless JWT cannot do
without a denylist anyway. Simpler than JWT rotation, same practical security
properties, and it is the mechanism `Session` in the data model is for.

### 3.3 CSRF, given cookies are `SameSite=Lax`

`SameSite=Lax` already blocks cookies on cross-site `POST`, which stops the
common CSRF case. We still add a classic **double-submit token**
(non-`HttpOnly` `csrf_token` cookie + required `X-CSRF-Token` header on every
mutating request, compared server-side) as defense in depth — it costs one
middleware and protects against the edge cases `SameSite` doesn't (older
browsers, subdomain takeover scenarios, misconfigured proxies).

### 3.4 `identity_reference_hash` for named/pseudonymous publications

For anonymous publications this field is zero-filled by definition. For named
and pseudonymous publications the spec still asks for a hash rather than the
raw identity id. Rationale made concrete: it is `SHA-256(publicIdentityId)`,
a **stable, one-way cross-reference** — it lets anyone (including future
tooling) group all on-chain publications by the same identity without the
chain holding an internal database primary key. It is not a secrecy
mechanism (the identity's username/display name is stored right next to it
in `author_display_snapshot`); it exists purely so on-chain data references
off-chain identities without embedding raw internal ids on a public ledger.

### 3.5 Revisions don't violate immutability

`previous_publication: Option<Pubkey>` only ever points to a **different,
already-finalized** account, set once at creation and never mutated
afterward. A "revision" is a brand-new `Publication` account; the original is
never touched. No contradiction, just worth stating explicitly since it reads
like an update at first glance.

### 3.6 Worker cardinality

The MVP runs exactly one worker process (inside the single container). The
outbox claim query still uses `FOR UPDATE SKIP LOCKED` so the code is correct
if that ever changes, but horizontal worker scaling is explicitly out of
scope for now (would need to additionally solve the counter race in §3.1 with
a lock or leader election — documented, not built).

## 4. Auth & RBAC

- Passwords: Argon2id (via `argon2` npm package, native binding), tuned to
  ~19MiB/2 iterations/1 lane baseline (OWASP minimum) — adjust in
  `apps/api/src/config/security.ts` if host resources allow more.
- Roles: `USER < MODERATOR < ADMIN`, stored as an enum column on `User`.
  Authorization is a small `requireRole()` middleware, not a permissions
  matrix — MVP has 3 roles and role checks are simple `>=` comparisons.
- Rate limiting: `express-rate-limit` with a Postgres-agnostic in-memory
  store is fine for a single-container MVP (no Redis dependency introduced
  for this); login/register/search get tighter limits than general API
  traffic.
- Account status: `ACTIVE | SUSPENDED | DELETED` on `User`; suspended users
  fail auth at session-validation time (existing sessions are revoked on
  suspension), not just at login.

## 4a. Identity model: Keepers, pen names, follows

Every account (a **Keeper**) has exactly one `PublicIdentity` row flagged
`isPrimary` — their **Keeper profile**, created in the same transaction as
registration (`identities/keeperProfile.service.ts`). Every other
`PublicIdentity` a Keeper owns is a **pen name**. Both are the same
underlying model; `isPrimary` plus a partial unique index
(`PublicIdentity_userId_primary_key`, added by hand in the
`20260825090000_add_keeper_profiles_and_follows` migration — Prisma's
`@@unique` can't express a `WHERE` clause) is what makes the Keeper profile
permanent: it can never be hidden, renamed more than once, or deleted.

A note or comment is published under one `PublicIdentity` either way —
`identityMode = NAMED` for the Keeper profile, `PSEUDONYMOUS` for a pen
name. This unifies cleanly with the pre-existing on-chain encoding: no
Anchor program change was needed to add this feature.

**Anonymous publishing is removed going forward, not retroactively.**
`IdentityMode.ANONYMOUS` (on-chain code `2`) stays in the enum forever —
already-published anonymous publications and comments must keep verifying
and keep rendering as anonymous, permanently. `ALLOW_ANONYMOUS_POSTING`
(`apps/api/src/config/env.ts`) is the runtime switch that stops the server
from accepting new `ANONYMOUS` submissions and legacy-shaped anonymous
comments; flipping it is a container env change, not a migration, and
reversible without a rollback. See `AGENTS.md` for the ship-order this
exists to support — mobile can lag the API by weeks and must keep working
against it in the meantime.

**Unlinkability is the load-bearing constraint.** A reader must never be
able to tell that two pen names, or a pen name and its owner's Keeper
profile, belong to the same account. `PublicIdentity.userId` is never
returned by any public DTO — `toIdentityDTO`, `toPublicationDTO`, and the
profile/search DTOs all omit it deliberately, guarded by
`anonymousSerialization.test.ts` and `keeperProfilesAndFollows.test.ts`.
Follows are the newest way this could leak, so:

- `Follow.followerUserId` is always the account, never a pen name — there
  is no way to follow "as" an identity, because a pen name's follow list
  would fingerprint its owner's own taste graph.
- A Keeper's own following list (`GET /follows/mine`) is visible only to
  that Keeper. It is the single strongest correlator available — following
  the same three obscure accounts from two different bylines links them
  immediately.
- A profile's follower *count* is shown; the follower *list* is not, by any
  endpoint. Below a small threshold (`FOLLOWER_COUNT_VISIBLE_AT` in
  `follows.service.ts`) the count itself is withheld too, so a pen name's
  first few followers can't be diffed by polling.
- Comment attribution follows the same no-side-channel rule the anonymous
  comment code already established: there is deliberately no "the author
  replied" badge anywhere, because showing one only when a commenter's
  byline matches the note's byline would itself confirm a link between two
  identities.

Deleting an account (`deleteOwnAccount`) now also deletes every `Follow` row
in both directions and scrubs the new profile fields (bio, avatar, links,
location, pronouns, birth date, gender) from any byline it can't hard-delete
— the same "hide, don't delete, if it has published content" rule
`deleteIdentity` already applied, extended to bylines with comments
(`Comment.publicIdentityId` is `ON DELETE RESTRICT`, not `SET NULL`, for the
same reason).

## 5. Draft state machine

```
DRAFT ──submit──▶ PENDING_REVIEW ──approve──▶ APPROVED ──(worker picks up)──▶
  CHAIN_PENDING ──▶ CHAIN_SUBMITTED ──finalized & verified──▶ PUBLISHED
  CHAIN_SUBMITTED ──failure exhausted──▶ CHAIN_FAILED (retryable by admin)

PENDING_REVIEW ──reject──▶ REJECTED (author may re-submit as a new draft copy)
PENDING_REVIEW ──request changes──▶ CHANGES_REQUESTED ──edit+resubmit──▶ PENDING_REVIEW
PENDING_REVIEW ──withdraw (author)──▶ DRAFT
DRAFT/CHANGES_REQUESTED/REJECTED ──delete──▶ (removed) or ──▶ ARCHIVED
```

Transitions are enforced by an explicit table in
`apps/api/src/modules/drafts/stateMachine.ts` — no endpoint sets `status`
directly; every mutation goes through `transition(draft, event, actor)` which
throws on an illegal edge. `CHAIN_*` states are set only by the worker, never
by the API directly (the API only ever writes `APPROVED` + the outbox row).

## 6. Publishing pipeline (API + worker)

1. Moderator calls `POST /moderation/submissions/:id/approve`.
2. In one Postgres transaction: `Submission`/`Draft` → `APPROVED`,
   `Publication` row created (content snapshot, `status=CHAIN_PENDING`,
   `contentHash` computed), `OutboxEvent` inserted (`eventType=PUBLISH_TO_CHAIN`,
   unique key = `publicationId`).
3. Worker polls/claims outbox rows with `SKIP LOCKED`, marks `lockedAt`.
4. Worker recomputes the SHA-256 content hash from the immutable snapshot and
   compares to the stored one (defends against a corrupted read).
5. Worker fetches the current `publication_counter` from the platform PDA,
   derives the expected publication PDA, builds & **simulates** the
   `publish_publication` transaction.
6. Worker signs with the platform publisher key (loaded from
   `SOLANA_PUBLISHER_KEYPAIR_PATH`, never from the request path), submits,
   stores the signature (`PublicationChainRecord.transactionSignature`,
   `blockchain_status=SUBMITTED`).
7. Worker awaits `confirmed` then `finalized` commitment (two separate
   status updates: `CONFIRMED`, `FINALIZED`).
8. Worker fetches + decodes the account, verifies discriminator, version,
   PDA, and content hash match. Only then does `Publication.status` become
   `PUBLISHED` and the outbox row `processed`.
9. Any failure before step 8 → `submission_attempts++`, exponential backoff,
   status `FAILED_RETRYABLE`; after a configurable max (`WORKER_MAX_ATTEMPTS`,
   default 8) → `FAILED_PERMANENT`, visible on `/admin/blockchain` for manual
   retry.

This whole flow is idempotent: retrying re-derives the same PDA from the same
publication id, and step 5 checks for an already-existing account at that PDA
before attempting to create it again (handles "we submitted, crashed before
recording the signature, and the tx actually landed" cleanly).

## 6a. Notifications (email + push)

Two parallel, deliberately-not-generalized outbox tables:
`EmailJob` (`packages/email`) and `PushJob` (`packages/push`), each with its
own claim/backoff loop in the worker
(`apps/worker/src/{email,push}/`) copying the same shape —
`FOR UPDATE SKIP LOCKED` claim, `PENDING → PROCESSING → SENT/FAILED`,
exponential backoff, an `AuditLog` entry once a job exhausts its retry
budget (`EMAIL_SEND_EXHAUSTED` / `PUSH_SEND_EXHAUSTED`). Neither reuses
`WorkerJob`/`OutboxEvent` — those are hard-wired to the chain-publish
pipeline. See `EmailJob`'s doc comment in `prisma/schema.prisma` for the
full reasoning; `PushJob` copies it rather than re-deriving it.

A trigger site enqueues both in the same Postgres transaction as the
business event that causes it (a comment, a moderation decision, a chain
finalization, a follow) — a rollback cancels both notifications, and
neither can survive without the event that was supposed to cause it.
`packages/email`/`packages/push` each validate a job's payload against a
per-`Kind` zod schema at enqueue time and again at send time (the second
check exists so a template/copy fix, shipped between enqueue and send,
applies retroactively to whatever's still queued).

The two channels intentionally don't cover the same events:
`PASSWORD_RESET_REQUESTED` and `WALLET_BALANCE_LOW` are email-only
(security-sensitive, or admin-only ops nobody needs on their phone);
`NEW_FOLLOWER` is push-only (no email has ever existed for it). See
`PushKind`'s doc comment in `packages/push/src/kinds.ts` for the exact
split.

Push delivery is direct: the worker calls Firebase Cloud Messaging via
`firebase-admin`, sending to the raw native FCM token the app registered
(`expo-notifications`' `getDevicePushTokenAsync`, not an Expo push token) —
there is no Expo push-relay service in this design. A user with zero
registered devices is a normal `SENT` outcome, not a failure, since most
Keepers will never install the mobile app; a device-specific "no longer
registered" error prunes that one `PushToken` row without failing the job.
Firebase being unconfigured never blocks anything upstream — the API keeps
enqueueing `PushJob` rows regardless, and the worker just warns at startup
and lets them retry with backoff until it is.

## 7. Solana program summary

See `programs/decentralized_notes/src/lib.rs` for the authoritative version.
Instructions: `initialize_platform`, `publish_publication`,
`publish_publication_v2`, `rotate_authority`. No `update_publication`, no
`delete_publication`, no `close_publication` — by design (§2.4 of the product
spec).

Two account types, both live, both readable:

| | `Publication` (v1) | `PublicationV2` |
|---|---|---|
| Body | stored on-chain, ≤ 600 bytes | off-chain; only the digest is committed |
| Excerpt | not stored | ≤ 280 bytes, **inside the hash preimage** |
| Account size | 887 bytes | 575 bytes (~31% less rent) |
| Hash checked on-chain | yes | no — see §2.1 |
| Status | frozen, still deployed | what new publications use |

Title ≤ 100 UTF-8 bytes and author display ≤ 50 are enforced on-chain in both,
as a second line of defense behind the API's own validation.

v1 is deliberately left deployed and untouched rather than removed: existing
accounts must keep decoding, and the v1 path stays reproducible in tests. The
two share one PDA seed (`["publication", id]`) and one `publication_counter`,
so the id space stays single and monotone — §3.1's invariant is unchanged. Any
code reading a publication account must go through
`fetchPublicationAccount` / `fetchAllPublicationAccounts` in
`packages/blockchain-client`, which dispatch on the discriminator. Calling
`program.account.publication.all()` directly matches only v1 and will silently
report every v2 publication as missing from the chain.

## 8. Deployment

Single Dockerfile, multi-stage (deps → prisma generate → build shared
packages → build web → build api → build worker → slim runtime image running
as a non-root user under s6-overlay/Supervisor, serving Nginx + API + worker).
PostgreSQL and Solana RPC are both external dependencies, never bundled into
the runtime image. See `IMPLEMENTATION_PLAN.md` §Docker for the exact stage
breakdown and `infra/` for Nginx/Supervisor config.

## 9. What is intentionally NOT built (see spec §25)

DAO governance, token rewards, NFTs, wallet login, ZK proofs, on-chain
comments/likes/bookmarks, follower feeds, ML recommendations, multi-chain
support. The data model and module boundaries are kept loose enough that
most of these are additive later (e.g. a `Reaction` model and router could
be added without touching `Publication` or the chain program).

## 10. Client topology

Two independent frontends share the one Express API — there is no
Capacitor/WebView wrapper (an earlier plan for that, in the now-retired
`MOBILE_APP_STRATEGY.md`, was superseded):

- `apps/web` — the React SPA served by Nginx (§1), cookie-based sessions.
- `apps/mobile` — an Expo / React Native app with its own UI, hitting the
  same API over `/api/v1` but authenticating with opaque bearer tokens
  (`/auth/mobile/*` endpoints, a `MOBILE` session transport) rather than
  cookies, since a native app has no browser cookie jar to rely on. See
  `apps/mobile/README.md` for its architecture (offline queue, theming,
  environments, release process).

Admin/moderation stays web-only by design — mobile has no equivalent surface.

## 11. SEO & analytics

`apps/web` is a client-only SPA (§1) — no SSR framework. Rather than migrate
to one (a change touching nearly every page) or accept that crawlers see a
blank shell, `apps/api/src/modules/seo` does targeted "dynamic rendering"
for exactly the public, crawlable/shareable routes: `/`, `/explore`,
`/how-it-works`, `/tags/:tag`, `/p/:id`, `/@:handle`, `/robots.txt`,
`/sitemap.xml`. Nginx `proxy_pass`es only those paths to the API instead of
`try_files`-ing the static `index.html`; the API rewrites the `<head>` block
between the `SEO:START`/`SEO:END` markers in that same file (read once from
`WEB_DIST_DIR`, cached in memory) and returns it otherwise untouched, so the
SPA still boots and hydrates exactly as it does today. Every other route
(dashboard, drafts, admin, settings, login) is unaffected — already
`Disallow`'d in `robots.txt`, no reason to pay for server rendering there.

Two things this has to get right:
- **Anonymity and identity.** `Publication` supports Keeper/pen-name/legacy-
  anonymous authorship (§4a). `seo.service.ts` only ever consumes the
  already-redacted DTO from `toPublicationDTO`/`getPublicationById` — it
  never queries `Publication`/`PublicIdentity` directly — so a legacy
  anonymous note's author can't leak into `og:` tags or JSON-LD, the same
  way it can't leak into the normal public API response, and no
  `PublicIdentity.userId` reaches crawler-facing HTML either.
- **Admin-editable without a redeploy.** GA4's Measurement ID, Search
  Console's verification code, the default OG image/description/Twitter
  handle, and a sitewide indexing on/off toggle live in a `SiteSettings`
  singleton row (admin UI at `/admin/settings`), read through a small
  in-memory cache in `settings.service.ts` invalidated on every write —
  the SEO router would otherwise hit Postgres on every public page load.

Impressions vs. unique readers: `PublicationView` (added earlier, see the
model's own doc comment) counts unique readers via a hashed first-party
visitor cookie — deliberately deduplicated, and deliberately never an IP or
account id. `Publication.impressionCount` is the raw, non-deduplicated
counterpart, incremented on every `POST /publications/:id/view` alongside
the existing dedup'd insert. Neither replaces the other; "how many times did
this load" and "how many distinct people read it" are different questions.

Google Search Console's own "Impressions" metric (how often a page shows up
in *search results*, as opposed to how often it's actually opened) isn't
pulled into the app at all — that would mean either OAuth or a service-
account key, both real setup cost for a metric already visible for free in
Search Console itself once a property is verified via the settings page's
verification-code field.
