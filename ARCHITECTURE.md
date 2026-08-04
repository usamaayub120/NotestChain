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
| **Finalized publication content** | **Solana account** | DB `Publication.content` is a cached copy for fast reads/search; it is rebuildable from chain. |
| User↔anonymous-publication linkage | PostgreSQL | Never on-chain, used only for abuse handling. |
| Search index | PostgreSQL `tsvector` | Rebuildable from `Publication` rows, which are rebuildable from chain + minimal off-chain metadata (author linkage, moderation provenance) that itself cannot be recovered from chain. |

**Rule enforced everywhere in code:** a publication is not "done" because an RPC
call returned a transaction signature. It is only `PUBLISHED` after the worker
observes **finalized** commitment, fetches the account, and verifies PDA +
content hash. See §6.

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

## 7. Solana program summary

See `programs/decentralized_notes/src/lib.rs` for the authoritative version.
Instructions: `initialize_platform`, `publish_publication`, `rotate_authority`.
No `update_publication`, no `delete_publication`, no `close_publication` —
by design (§2.4 of the product spec). Size limits are enforced on-chain
(title ≤ 100 UTF-8 bytes, author display ≤ 50, body ≤ 600) as a second line
of defense behind the API's own validation.

## 8. Deployment

Single Dockerfile, multi-stage (deps → prisma generate → build shared
packages → build web → build api → build worker → slim runtime image running
as a non-root user under s6-overlay/Supervisor, serving Nginx + API + worker).
PostgreSQL and Solana RPC are both external dependencies, never bundled into
the runtime image. See `IMPLEMENTATION_PLAN.md` §Docker for the exact stage
breakdown and `infra/` for Nginx/Supervisor config.

## 9. What is intentionally NOT built (see spec §25)

DAO governance, token rewards, NFTs, wallet login, ZK proofs, on-chain
comments/likes/bookmarks, follower feeds, ML recommendations, native mobile
apps, multi-chain support. The data model and module boundaries are kept
loose enough that most of these are additive later (e.g. a `Reaction` model
and router could be added without touching `Publication` or the chain
program).
