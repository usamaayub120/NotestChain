# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary user is a **reflective writer**: someone who already journals or
writes essays privately, and occasionally wants one thought to exist
publicly and permanently. They arrive to write, not to browse. The draft
editor is the product for them; reading other people's notes is secondary.

Readers are a real but secondary audience, served by the public reader,
profiles, tags, search, and SEO routes. Staff (moderators, campaign
creators/approvers, platform admins, access managers, owner) are a third,
internal audience served entirely by the web admin portal — mobile has no
equivalent surface, by design.

## Product Purpose

NotesChain is a public writing platform: private drafts, moderated
publishing, and a final permanent, publicly-verifiable record on Solana.
A writer drafts in private, submits for review, and on approval the note is
published and committed to chain, where its existence at a given time can be
verified by a third party forever.

**Success right now is that writers finish and publish** — a draft started
becomes a kept note. Moderation and the irreversible-publish confirmation
are friction to design *around*, not to remove: they are deliberate product
properties, because the result is permanent.

## Positioning

A notebook that became public, not a blockchain product wearing a writing
app as a costume. The chain is a quiet proof of keeping rather than the
headline.

The mechanism a neighboring product could not truthfully copy: publication
is irreversible and independently verifiable without trusting NotesChain.
Each published note commits
`sha256("noteschain/pub/v2" || title, excerpt, content)` plus the title and a
280-byte excerpt to a Solana account, and a publication is only `PUBLISHED`
after the worker observes **finalized** commitment, fetches the account, and
verifies PDA and content hash. A returned transaction signature is never
treated as done.

The second, quieter differentiator is the identity model: a writer can
publish under their Keeper profile or an unlinkable pen name, and readers
cannot tell the two belong to one account.

## Operating Context

- Two independent clients share one Express API: this web SPA
  (`apps/web`, cookie sessions) and an Expo/React Native app
  (`apps/mobile`, opaque bearer tokens). No WebView wrapper.
- Writing flow: draft → autosave → submit → moderation queue → approve /
  request changes / reject → chain queue → finalized → published.
  `DraftStatus` carries ten states; `ChainStatus` eight; `VerificationState`
  eight.
- Publishing is online-only and gated behind an explicit irreversible
  confirmation. Neither client ever holds a Solana private key.
- Registration and commenting are gated by a Cloudflare Turnstile bot check.
  Native clients route that check through this web app's `/mobile-captcha`
  bridge, which must stay in the web build while native registration or
  comments are enabled.
- Admin and moderation are web-only and permission-gated
  (`RequirePermission` / `RequireAnyPermission`), not role-ladder gated.
- Public, crawlable routes (`/`, `/explore`, `/how-it-works`, `/tags/:tag`,
  `/p/:id`, `/@:handle`) get dynamic `<head>` rendering from the API; every
  authenticated route is `Disallow`ed and client-rendered only.
- The web build is a PWA with an update banner; it ships inside a single
  Docker image served by Nginx alongside the API and worker.

## Capabilities and Constraints

**Built:** registration/login/password reset, Keeper profiles and pen names,
drafts with autosave and version history, markdown editing with a format
toolbar, tags, discoverability (public/unlisted), submission and moderation,
on-chain publishing and live verification, the public reader, comments,
bookmarks, follows, profiles, search, explore, tag pages, unique-reader
counts, writer analytics, legal pages, self-service account deletion,
staff access management, campaigns, audit log, blockchain job monitoring,
wallet balances, SEO settings, dark/light theming.

**Terminology (binding).** A **Keeper** is an account; every Keeper has
exactly one permanent Keeper profile plus any number of **pen names** —
both are `PublicIdentity` rows. A note is **kept**, not hashed. Notes are
**published**; publications are **verified**, **delisted**, never deleted.

**Hard constraints future work must preserve:**

- **Permanence.** Published content and its byline stay exactly as
  published. `Publication` and `Comment` hold `ON DELETE RESTRICT` foreign
  keys to `User`, so account deletion is a soft delete. This is the product
  promise, not a compliance gap.
- **Unlinkability.** A reader must never be able to tell that two pen names,
  or a pen name and its owner's Keeper profile, belong to one account.
  `PublicIdentity.userId` never leaves the server. Follower *lists* are
  never exposed, follower counts are withheld below a threshold, a Keeper's
  own following list is visible only to them, and there is deliberately no
  "author replied" badge on comments.
- **Anonymous publishing is removed going forward, not retroactively.**
  `IdentityMode.ANONYMOUS` stays in the enum forever; already-published
  anonymous notes and comments must keep rendering and verifying as
  anonymous. New byline pickers offer only NAMED and PSEUDONYMOUS.
- **Never fake a state.** The verification stamp appears only once something
  is actually confirmed on chain.
- **No device fingerprinting or IP-based identifiers.** Unique readers are
  counted via a one-way server-side hash of a first-party visitor value.
- **Browser sessions stay HTTP-only cookies.** Never change the browser
  session flow to accommodate the native client.
- Size limits are enforced client-side, API-side, and on-chain with the same
  numbers: title 100 bytes, author display 50 bytes, excerpt 280 bytes,
  comment 600 bytes, bio 280 bytes, note body 20,000 characters to submit
  (40,000 hard autosave ceiling, so an over-length draft never loses words),
  5 tags per publication, tag 24 chars, username 3–30.
- Body length is reported to writers in **characters**, never bytes —
  charging a writer 4 for one emoji was the bug, not a detail of it.
- Client-only SPA. No SSR framework; dynamic rendering covers crawlers.

**Deliberately not built:** DAO governance, token rewards, NFTs, wallet
login, ZK proofs, on-chain comments/likes/bookmarks, ML recommendations,
multi-chain support.

## Brand Commitments

- Name **NotesChain**, tagline **"Thoughts worth keeping."**, operating
  entity **FreeSoul**, support **support@noteschain.org**. All sourced from
  `packages/shared/src/brand.ts`, which is the single source of truth —
  never write the name as a literal.
- Voice is quiet-editorial: plain, unhurried, no marketing enthusiasm, no
  rule-of-three listing, no Web3 landing-page tropes. Permanence is
  reassuring, not intimidating. The `noteschain-copywriter` skill owns
  user-facing text.
- The incumbent visual system is documented in the repo-root
  `DESIGN_SYSTEM.md` (and `UI_IMPLEMENTATION_PLAN.md`). It is a deliberate
  anti-template position, not a default, and is design authority until
  explicitly replaced.
- `AGENTS.md` at the repo root is binding on release and deployment scope.

## Evidence on Hand

- Live production site at `https://noteschain.org` with live `/privacy`,
  `/terms`, and `/delete-account` pages.
- A deployed Anchor program and real devnet verification; `anchor build`
  succeeds, `anchor test` does not yet run in this environment.
- Real integration tests exercising actual HTTP, sessions, CSRF, and role
  checks against a real Postgres instance.
- Repo documentation: `README.md`, `ARCHITECTURE.md`, `AGENTS.md`,
  `RUNBOOK.md`, `BACKUP_RECOVERY.md`, `DESIGN_SYSTEM.md`,
  `IMPLEMENTATION_PLAN.md`, `UI_IMPLEMENTATION_PLAN.md`.

**Absences future work must not fabricate:** there are no testimonials,
named customers, usage numbers, press coverage, case studies, pricing, or
funding. No audience size has been established. The product is pre-audience;
do not write copy or design surfaces that imply otherwise.

## Product Principles

1. **The words come first.** Chrome, badges, and metadata stay quiet; the
   note is the only thing that must be loud.
2. **A finished draft is the goal.** Every surface between opening the
   editor and seeing a note kept should remove doubt, not add steps.
3. **Permanence is explained, never surprised.** Irreversible actions are
   stated plainly before they happen, in words a writer can act on.
4. **Earned trust, not decoration.** No state is shown until it is true.
5. **Unlinkability is a feature, not a setting.** Anything that could
   correlate two bylines is a defect, including in the UI.

## Accessibility & Inclusion

**WCAG 2.2 AA is the required bar.** The existing baseline rules stand and
are consistent with it:

- Touch targets ≥ 44×44px including icon-only buttons, via hit-area padding.
- Never rely on color alone — verification, discoverability, and status
  always pair color with an icon and a text label.
- Viewport allows zoom (`user-scalable=yes`, no `maximum-scale=1`).
- Focus-visible outline is restyled, never removed.
- Sheets and modals trap focus, restore focus to the trigger on close, and
  are dismissible by Escape and a labeled close control.
