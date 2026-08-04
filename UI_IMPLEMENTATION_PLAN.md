# UI_IMPLEMENTATION_PLAN.md — NotesChain

Companion to `DESIGN_SYSTEM.md`. This is the page/component inventory and the
state matrix every page must satisfy before it's considered done.

## 1. Pages

| Route | Auth | Priority | Notes |
|---|---|---|---|
| `/` | public | P0 | Home — human-first hero, not a Web3 landing page |
| `/explore` | public | P0 | Discovery feed, sectioned (§DESIGN_SYSTEM §13 analog) |
| `/search` | public | P0 | Full filter set, shareable query string |
| `/p/:publicationId` | public | P0 | Reader |
| `/@:username` | public | P0 | Profile |
| `/tags/:tag` | public | P1 | Tag listing, reuses Explore card grid |
| `/login`, `/register` | public | P0 | |
| `/dashboard` | user | P0 | Snapshot: drafts in progress, recent publications, pending submissions |
| `/drafts`, `/drafts/new`, `/drafts/:id/edit` | user | P0 | List + full-screen editor |
| `/publications` | user | P1 | Author's own publication history (all identities + anonymous, clearly separated) |
| `/identities`, `/identities/new` | user | P0 | |
| `/bookmarks` | user | P1 | |
| `/settings` | user | P1 | Account, password, session list ("sign out everywhere") |
| `/admin` | mod/admin | P1 | Landing dashboard |
| `/admin/submissions`, `/admin/submissions/:id` | mod/admin | P0 | Queue + detail/decision screen |
| `/admin/users` | admin | P1 | |
| `/admin/reports` | mod/admin | P1 | |
| `/admin/publications` | mod/admin | P1 | Delist/restore |
| `/admin/blockchain` | admin | P1 | Outbox/job dashboard, retry |
| `/admin/audit` | admin | P2 | |

P0 = required for the Phase 1–2 vertical slice to be demoable; P1 ships with
Phase 5; P2 can trail slightly.

## 2. Component inventory → owning page(s)

Per the spec's component list (§10 of the UI brief). Build order follows
what P0 pages need first:

`MobileAppShell`, `MobileBottomNavigation`, `MobileTopBar` → every page
`PublicationCard` → Explore, Search, Profile, Tags
`PublicationReader` → `/p/:id`
`AuthorIdentityBadge`, `AnonymousIdentityBadge` → PublicationCard, Reader, Profile
`VerificationBadge`, `BlockchainProofSheet` → Reader
`DraftAutosaveIndicator`, `DraftEditor`, `IdentitySelector`,
`DiscoverabilitySelector`, `TagSelector` → `/drafts/:id/edit`
`SearchBar`, `SearchFiltersSheet` → Search, Explore
`ProfileHeader` → `/@:username`
`EmptyState`, `ErrorState`, `LoadingSkeleton` → every list/detail page
`ConfirmationSheet`, `PublicationWarningDialog` → submit flow
`ReportPublicationSheet` → Reader
`BookmarkButton` → Card, Reader
`RevisionTimeline` → Reader (when `previousPublication` exists)

All built from shadcn/ui primitives (Sheet, Dialog, Command, Form, Badge,
Skeleton, Tabs, DropdownMenu) via the shadcn MCP/CLI — install per-component
as needed, adapt tokens/classes to `DESIGN_SYSTEM.md`, never paste a stock
block unmodified.

## 3. State matrix (every P0/P1 page must define all six)

| State | Rule |
|---|---|
| Loading | Skeleton matching the real layout's shape, never a spinner-only page for list/detail views |
| Empty | `EmptyState` with one sentence of context + one primary action (e.g. Explore with zero results → "Nothing's been kept yet — be the first" + Write button) |
| Error | `ErrorState` — plain language, a retry action, never a raw error/stack |
| Permission | Authenticated-only pages redirect to `/login?next=`; role-gated admin pages render a plain "not available" rather than a 403 wall of text |
| Offline | Editor: keep local content, show "Offline — we'll save when you're back"; read pages: cached-if-available else `ErrorState` variant |
| Success/edge | Long titles wrap not truncate destructively; emoji/non-Latin content tested; max-size note (600 UTF-8 bytes) still renders without overflow |

## 4. Mobile vs desktop behavior (delta only — mobile is the default)

- **Nav**: bottom bar (mobile) → left sidebar (≥1024px), same 5 destinations.
- **Editor**: full-screen (mobile) → centered column + optional metadata
  side panel (≥1024px), never a modal.
- **Filters**: bottom sheet (mobile) → inline popover/panel (≥768px).
- **Admin tables**: card/drill-down list (mobile) → real `<table>` (≥1024px).
- **Reader**: single column, sticky bottom action bar only if it doesn't
  cover text (mobile) → centered column + optional side rail for
  proof/revisions (≥1024px).

## 5. Loading/offline/update strategy (PWA)

- Vite `manifest.webmanifest` + icons (192/512 + maskable), `theme-color`
  matching `--background` per scheme, `apple-touch-icon`.
- Service worker (via `vite-plugin-pwa`, `registerType: "prompt"` — never
  silent auto-activate that could hide a stale build): caches versioned
  static assets (JS/CSS/fonts/icons) and public GET responses for
  `/api/v1/publications`, `/api/v1/search`, `/api/v1/profiles/*` with a
  short (5 min) stale-while-revalidate window for snappier repeat visits —
  **never** caches anything under an authenticated session (drafts,
  `/auth/me`, bookmarks, admin) and the SW explicitly bypasses caching for
  any request carrying the session cookie's mutation verbs.
- Update UX: a small "New version available — Refresh" toast when a new SW
  is waiting, never a forced reload.

## 6. Visual QA criteria (see spec §16 matrix — this is the checklist per page)

For each P0 page, before marking done:

1. Renders correctly at 320/360/390/430/768/1024/1280/1440 with no
   horizontal scroll.
2. Long title (150+ chars), long pseudonym, emoji, and non-Latin (e.g.
   Devanagari/CJK) content don't break layout.
3. Max-size note (exactly 600 UTF-8 bytes incl. multi-byte chars) renders.
4. Empty and error states visually reviewed, not just implemented.
5. Light + dark theme both reviewed.
6. `prefers-reduced-motion` reviewed (no residual animation).
7. Keyboard-only pass: tab order, focus rings, Escape closes sheets/modals.
8. Mobile keyboard open (input focused) doesn't hide the field or the
   primary action behind the OS keyboard.
9. Slow network (throttled) — skeleton shows, no layout jump on data
   arrival.
10. Screenshot captured via the browser tool at 390×844 and 1280×800 and
    diffed against `DESIGN_SYSTEM.md` intent before moving to the next page.

This checklist is run per-page as each is built (per the spec's explicit
instruction not to defer responsive testing to the end), tracked as a
sub-task under Phase 6 but actually exercised continuously from Phase 1
onward for every page as it lands.
