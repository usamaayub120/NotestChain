# NotesChain — Backup & Recovery Notes

What to back up, why, and what actually happens if each piece is lost.

> **This document changed when v2 publications shipped. Read §1.1.**
>
> It used to say published content was the one thing that could never be
> lost, because it lived on Solana. That is still true of v1 publications and
> is **no longer true of v2 ones**, whose bodies live only in Postgres. Backups
> went from a convenience to the only copy of published note text.

## 1. What's where, and what losing it means

| Data | Lives in | If lost |
|---|---|---|
| Published content of **v1** publications (title, content, hash, author snapshot) | Solana, permanently | **Not lost** — it's on-chain by design. Postgres losing its copy just means the read-path (search, browse, the reader page) breaks until restored; the content itself survives. |
| Published **body** of **v2** publications | **Postgres only** | **Lost if Postgres is lost with no backup.** The chain holds the title, a 280-byte excerpt, and a SHA-256 commitment — enough to *prove* a body is authentic if you still have it, not enough to *reconstruct* it. See §1.1. |
| Drafts, in-progress submissions, moderation history, reports, audit log, sessions | Postgres only | **Lost if Postgres is lost with no backup.** None of this exists anywhere else. |
| The publisher keypair | Wherever `SOLANA_PUBLISHER_KEYPAIR_PATH` points (a mounted secret, not in Postgres, never in the DB) | The worker can no longer *submit new* publish transactions. Already-published content is unaffected (see above). Recovery is "generate/fund a new keypair" — see `RUNBOOK.md` §3 — not "restore from backup." Back it up anyway so you don't have to re-fund a wallet unnecessarily; but losing it is an inconvenience, not a data-loss event. |
| The program's on-chain state (`platform_config`, every `Publication` account) | Solana, permanently | Not a "backup" concept at all — it's replicated across the whole Solana validator set. The only thing that can affect it is the program's own upgrade authority being misused (see `RUNBOOK.md` §1). |

So: **Postgres is the only thing that needs a conventional backup/restore
story.** Everything else either doesn't need one (on-chain data) or has a
different recovery path entirely (the publisher keypair).

## 1.1 v2 publications: backups are now load-bearing

Long notes required moving the body off-chain — Solana's 1232-byte
transaction limit capped v1 bodies at 600 bytes and no tuning changed that
(see ARCHITECTURE.md §2.1). From `chainSchemaVersion = 2` onward the chain
stores the title, a 280-byte excerpt, and the content hash. It does not store
the note.

What this changes operationally:

- **Losing Postgres without a backup permanently destroys published note
  bodies.** They are not recoverable from chain, from the excerpt, or from the
  hash. This is a real data-loss scenario that did not exist before, and it is
  the single most important line in this document.
- The promise made to writers is unchanged and still honoured: a published
  note is immutable and publicly witnessed. Anyone can verify a body we serve
  against the on-chain commitment. What we can no longer do is *re-derive* a
  body we have lost.
- Restore drills matter more than they used to. A backup that has never been
  restored is a hypothesis. Include `Publication.content`, `contentPlain`,
  `excerpt`, `contentHash`, `contentBytes`, and `chainSchemaVersion` — the
  content hash covers title + excerpt + body, so an excerpt restored out of
  sync with its body fails verification just as a wrong body would.
- After any restore, run the worker's reconciliation sweep. It compares every
  `PUBLISHED` row against both on-chain account types and flags
  `RECONCILIATION_HASH_MISMATCH` / `RECONCILIATION_MISSING_ON_CHAIN` /
  `RECONCILIATION_VERSION_MISMATCH` into the audit log. That sweep is now the
  fastest way to find out whether a restore was complete and faithful.

Two guards exist so the realistic failure is loud rather than silent, but
neither is a substitute for a backup: `Publication.contentBytes` is
cross-checked against the on-chain `content_length` at verification time, and
a Postgres trigger raises an exception on any attempt to modify `content`,
`title`, `excerpt`, or `contentHash` of a row whose status is `PUBLISHED`.

## 2. Postgres backup

Nothing in this repo currently automates this — there's no cron job, no
`pg_dump` wrapper script, no S3/off-site sync configured anywhere in
`Dockerfile`/`infra/`. That's deliberate: Postgres is explicitly external
to the deployment (see `README.md`'s Docker section — "PostgreSQL ... never
bundled into this image"), so backup policy belongs to whatever manages
that Postgres instance (a managed DB service's own backup/PITR, or your own
cron + off-site copy if self-hosting it). What to actually back up:

```bash
pg_dump --format=custom --file=noteschain_$(date +%Y%m%d).dump "$DATABASE_URL"
```

Restore:

```bash
pg_restore --clean --if-exists --dbname="$DATABASE_URL" noteschain_YYYYMMDD.dump
```

After any restore, run migrations to catch the DB up to whatever schema
version the *code* you're running expects — a backup taken before a
migration was applied will otherwise be schema-stale:

```bash
pnpm exec prisma migrate deploy --schema prisma/schema.prisma
```

Recommended cadence: at minimum daily, with point-in-time recovery if your
Postgres host supports it — `Session`, `WorkerJob`, and `OutboxEvent` all
churn continuously while the platform is live, so a stale backup means
losing everything written since.

## 3. Recovering from a stale or partially-restored Postgres

This is the scenario that actually matters most in practice: Postgres gets
restored from a backup that's a few hours (or days) old, and is now out of
sync with what's actually on-chain (the worker published things after the
backup was taken, or a submission was approved after the backup point).

**This is exactly what the Phase 5 reconciliation sweep is for** — it's not
just an ongoing-drift detector, it's the recovery mechanism after a
restore too:

1. Restore Postgres from backup, run migrations.
2. Restart the worker. Its reconciliation sweep
   (`apps/worker/src/reconciliation/reconcile.ts`, runs every
   `WORKER_RECONCILE_INTERVAL_MS`, default 5 min) does a
   `getProgramAccounts` sweep of every on-chain `Publication` and diffs it
   against Postgres's `PUBLISHED` rows.
3. Anything on-chain with no matching DB row shows up as
   `RECONCILIATION_ORPHAN_ON_CHAIN` in the audit log
   (`/admin/audit-log`) — these are publications that existed before the
   backup point was lost from Postgres. **Review each one manually and
   re-create the corresponding `Publication`/`PublicationChainRecord` rows
   from the on-chain account's data** (title, content, hash, publication
   id, PDA) — there is no automated repair for this by design (see the
   reconciliation job's own doc comment: it flags, it never "fixes"
   silently, because inferring the right DB state from on-chain data alone
   risks getting authorship/identity-mode metadata wrong).
4. Anything in a non-terminal state (`CHAIN_PENDING`, `CHAIN_SUBMITTED`,
   or a `WorkerJob` stuck `PROCESSING`) after a restore should be treated
   as "unknown outcome" — check `/admin/blockchain` for its
   `PublicationChainRecord.transactionSignature` if one was recorded, look
   it up on a Solana explorer, and either let the worker's own idempotent
   retry (`tryVerifyExisting` in `publishToChain.ts`) resolve it, or use
   the admin "Retry" action if it's stuck `FAILED`.

## 4. Worker crash recovery (no backup needed — this one's automatic)

If the worker process dies mid-publish at any point — after submitting a
transaction but before recording the signature, mid-confirmation, whatever
— **no manual recovery step is needed**. This was a deliberate design
goal (see `ARCHITECTURE.md` §6, the outbox pattern): every step re-derives
the same PDA from the same publication id, and `tryVerifyExisting` checks
for an already-existing, already-matching on-chain account before ever
attempting to create one. On restart, `claimNextJob`'s `FOR UPDATE SKIP
LOCKED` query just picks the job back up and it converges to the same
end state. This is unit-tested (`apps/worker/src/publishing/*.test.ts`)
for the claim/backoff/dead-letter logic specifically.

## 5. What's genuinely unrecoverable

- **A draft's content that was never submitted/approved/published, if
  Postgres is lost with no backup covering it.** There's no on-chain
  fallback for drafts — that's the whole point of the draft stage existing
  off-chain.
- **Moderation history and audit log entries older than your backup
  retention window.** These are operational/compliance records, not
  recoverable from any other source.
- **The publisher keypair itself, if you never backed it up and it's lost
  before you rotate to a new one.** Not a data-loss event (see §1), but it
  does mean manually generating and funding a replacement before the
  worker can publish anything new again.
