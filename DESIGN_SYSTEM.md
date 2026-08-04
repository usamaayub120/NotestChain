# DESIGN_SYSTEM.md — NotesChain

> "Thoughts worth keeping."

## 1. Product personality

NotesChain is a **notebook that became public** — the feeling of a personal
journal that occasionally lets a thought out into the world, permanently. It
sits between a private notes app and a small editorial magazine. It is not a
blockchain product wearing a writing app as a costume: the chain shows up as
a quiet **proof of keeping**, not as the headline.

Three sentences that describe every screen we build:

1. The words come first. Chrome, badges, and metadata are quiet by default.
2. Permanence is reassuring, not intimidating — we say "kept," not "hash."
3. Every screen should feel handwritten-considered, not database-generated.

### Brand principles

- **Editorial restraint** — one accent color does the talking per screen.
- **Calm density** — mobile screens carry one primary task, never three.
- **Earned trust, not decoration** — the verification stamp only appears
  once something is actually confirmed; we never fake a state.
- **Anonymous is a first-class citizen**, not a grey placeholder — its
  presentation gets the same design care as named authorship.

## 2. Why this system, not the default

The obvious AI-generated answer to "blockchain writing app" is a dark
dashboard with a purple gradient hero and a neon-green "verified" pill. We
deliberately avoided that combination:

- **Display type is an expressive grotesk, not a high-contrast serif** —
  sidesteps the cream-background/serif/terracotta template by changing the
  type axis instead of fighting the (legitimately good) warm-paper
  background.
- **The signature motif is a wax-seal-style "kept" stamp**, not a chain
  link, checkmark-in-a-shield, or blockchain glyph. It's the one bold,
  ownable visual idea; everything else stays quiet around it.
- **Primary accent is an ember/coral, not violet or acid-green** — warm,
  human, ties literally to "sealing" a thought.
- **Cards have one asymmetric signature detail** (a folded top-right
  corner, like a kept page), not uniform rounded rectangles everywhere.

## 3. Color tokens

Named palette (source values — implemented as CSS variables, see §3.3):

| Name | Hex | Role |
|---|---|---|
| `paper` | `#F6F1E8` | Light mode background — warm, soft, not stark white |
| `ink` | `#201E1B` | Light mode primary text / dark mode surface-elevated |
| `dusk` | `#16151A` | Dark mode background — warm-black, not pure #000 |
| `ember` | `#E1502F` | Primary accent — Write action, active states, the seal |
| `kept` | `#3F6B4C` | Verification / trust color — restrained moss green |
| `mist` | `#8B8477` | Neutral mid-tone — secondary text, borders (light mode base) |

### 3.1 Light theme

```css
--background: #F6F1E8;
--foreground: #201E1B;
--surface: #FFFFFF;
--surface-elevated: #FBF8F2;
--primary: #E1502F;
--primary-foreground: #FFFFFF;
--muted: #EDE7DB;
--muted-foreground: #6F695D;
--border: #DDD5C4;
--success: #3F6B4C;
--warning: #B8862B;
--destructive: #C4361F;
--verified: #3F6B4C;
--verified-foreground: #F3F7F1;
```

### 3.2 Dark theme

```css
--background: #16151A;
--foreground: #F1EDE3;
--surface: #1E1D22;
--surface-elevated: #26242B;
--primary: #FF6B45;
--primary-foreground: #16151A;
--muted: #2A2830;
--muted-foreground: #9C968A;
--border: #34313A;
--success: #6FA37E;
--warning: #D9A64C;
--destructive: #E5674A;
--verified: #6FA37E;
--verified-foreground: #12241A;
```

### 3.3 Implementation

Tokens live in `apps/web/src/styles/tokens.css` as `:root` (light default)
and `:root[data-theme="dark"]` / `@media (prefers-color-scheme: dark)`
overrides, mapped into Tailwind via `tailwind.config.ts` `theme.extend.colors`
(`background`, `foreground`, `primary`, `muted`, `border`, `success`,
`warning`, `destructive`, `verified`, each with a `-foreground` pair).
Components must reference the Tailwind tokens (`bg-background`,
`text-foreground`, `bg-primary`, ...), never raw hex values.

Secondary accents (tags, identity badges) draw from a small fixed rotation
of 5 desaturated hues (clay, sage, slate, plum, sand) assigned
deterministically by hashing the tag/identity id — never assigned randomly
per render, and never more saturated than the primary accent.

## 4. Typography

Three families, one job each:

| Role | Family | Notes |
|---|---|---|
| Display / headings | **Bricolage Grotesque** | Variable font, distinctive ink-trap details. Used for H1–H3, the wordmark, and section labels. Never for body copy. |
| UI / body | **Figtree** | Warm, highly readable sans. All body text, form fields, buttons, nav. |
| Technical / proof values | **IBM Plex Mono** | Transaction signatures, PDAs, hashes only — never for prose. |

Both variable fonts are self-hosted (`apps/web/public/fonts/`) to avoid a
runtime dependency on a font CDN inside a WebView.

### Scale (mobile default, `min-width` enhancements scale up)

```
--text-xs:   0.8125rem / 1.25   (13px)  captions, timestamps
--text-sm:   0.9375rem / 1.4    (15px)  secondary UI text
--text-base: 1rem / 1.6         (16px)  form inputs (never smaller on mobile)
--text-body: 1.0625rem / 1.65   (17px)  publication reading body, mobile
--text-lg:   1.125rem / 1.4     (18px)  card titles
--text-xl:   1.375rem / 1.3     (22px)  section headings
--text-2xl:  1.75rem / 1.2      (28px)  page titles
--text-3xl:  2.25rem / 1.1      (36px)  hero / display, mobile
```

Desktop (`min-width: 768px`): `--text-body` → 1.125rem/1.7,
`--text-3xl` → 3.25rem. Never below 14px for any UI label, never below
16px for any form input, per accessibility requirements.

## 5. Spacing, radius, shadow

```
--space-1: 4px   --space-2: 8px   --space-3: 12px  --space-4: 16px
--space-5: 20px  --space-6: 24px  --space-8: 32px  --space-10: 40px
--space-12: 48px --space-16: 64px
```

Radius:

```
--radius-sm: 6px   inputs, chips
--radius-md: 10px  buttons, standard cards
--radius-lg: 16px  sheets, modals
--radius-full: 999px  avatars, pills (used sparingly — not every button)
```

Shadow (light mode; dark mode uses a lighter-alpha border instead of shadow):

```
--shadow-sm: 0 1px 2px rgba(32,30,27,0.06)
--shadow-md: 0 4px 12px rgba(32,30,27,0.08)
--shadow-lg: 0 12px 32px rgba(32,30,27,0.14)   /* sheets/modals only */
```

## 6. The signature element: the Kept Stamp

A small circular mark (28px inline / 56px in the verification sheet):
a hand-drawn-feel double ring (outer ring hairline, inner ring solid) with
a single short diagonal tick inside — deliberately closer to a postal/wax
seal mark than a checkmark-in-a-badge. Rendered as inline SVG using
`--verified` as its stroke/fill color.

States:

- **Not yet submitted for proof** — no stamp shown at all (we never show a
  greyed-out "pending chain" badge on cards; unpublished content simply
  doesn't carry the mark).
- **Confirming** — stamp outline only, `--muted-foreground`, no fill,
  subtle 1.2s opacity pulse (respects `prefers-reduced-motion`: static at
  60% opacity instead).
- **Kept (verified)** — full stamp in `--verified`, plays a single 220ms
  scale-from-0.85 + fade-in the first time it's rendered *after* a live
  verification call resolves `VERIFIED` (never on every render — no
  ambient animation).
- **Mismatch / unable to verify** — stamp rendered in `--destructive` /
  `--warning` outline with a small "!" — see `BlockchainProofSheet` states.

This is the only motif allowed to represent blockchain proof anywhere in the
product. No chain-link icons, no crypto glyphs, no wallet iconography.

## 7. Iconography & motion

- Icon set: **Lucide**, 20px default stroke-width 1.75, one size per
  context (16px inline-with-text, 20px standalone controls, 24px nav).
- No mixing icon libraries.
- Motion timing: 150–300ms, `ease-out` for entrances, `ease-in` for exits.
  Page transitions: 200ms cross-fade + 8px slide. Bottom sheets: 250ms
  spring-like ease (`cubic-bezier(0.32, 0.72, 0, 1)`, the standard
  iOS-sheet curve — chosen because it must feel native inside a WebView).
  All motion wrapped so `prefers-reduced-motion: reduce` collapses
  durations to ≤1ms.

## 8. Component states (baseline contract for every interactive component)

Every button, input, card action, and nav item must define: `default`,
`hover` (desktop only — never required for function), `focus-visible`
(2px `--primary` outline, 2px offset), `active/pressed`, `disabled`,
`loading` (where async). Form fields additionally define `error` (red
border + inline message + `aria-describedby`) and `success` where relevant
(e.g. username availability).

## 9. Navigation

### Mobile (< 768px), authenticated

Fixed bottom bar, 5 items max, safe-area aware:

```
┌──────────────────────────────────────────────┐
│                                                │
│                (page content)                 │
│                                                │
├──────────────────────────────────────────────┤
│   Home     Explore    ✦Write✦    Saved   Profile│
│    ⌂          ◎          +          ♡       ○  │
└──────────────────────────────────────────────┘
        padding-bottom: env(safe-area-inset-bottom)
```

`Write` is visually distinct: raised 6px, filled `--primary` circle behind
the `+`, drop shadow `--shadow-md`. Active item: icon + label in
`--primary`, others in `--muted-foreground`. Labels always visible
(never icon-only).

### Mobile, unauthenticated

```
Home   Explore   Search   Sign in
```

Same bar mechanics, 4 items, "Sign in" replaces the profile slot.

### Desktop (≥ 1024px)

Left sidebar (fixed, 240px) with the same 5 items plus secondary links
(Identities, Settings), full-height, `Write` rendered as a filled button
at the top of the sidebar rather than a floating circle. Same information
architecture as mobile — no desktop-only nav items.

## 10. Content width & breakpoints

```
320, 360, 390, 430   → single column, 16px side padding
768                   → single column, 24px side padding, cards may go 2-col in Explore
1024                  → sidebar nav appears; reading column max-width 680px
1280                  → reading column max-width 720px; Explore may go 3-col
1440                  → same as 1280, extra space stays as margin, never stretches content
```

Reading content (`PublicationReader`, `DraftEditor` body) never exceeds a
`72ch` measure at any breakpoint.

## 11. Example: PublicationCard (mobile, 390px)

```
┌───────────────────────────────────────╮╮  ← folded corner (signature detail,
│ ⚫ Anon · Anonymous voice          ⋯  │      this card only, top-right, 12px)
│                                        │
│ Some nights the city sounds like a    │
│ held breath.                          │
│                                        │
│ #night  #city                    ◈    │  ← ◈ = Kept stamp, only if verified
│ 2h ago                          ♡ 14  │
╰────────────────────────────────────────╯
```

Named/pseudonymous variant swaps the top row for
`AuthorIdentityBadge` (avatar 24px + display name + username, no dot).

## 12. Example: profile header (mobile)

```
┌────────────────────────────────────┐
│         (avatar, 72px)             │
│         Marguerite Vale            │
│         @marguerite                │
│                                     │
│  Notices small things. Keeps a     │
│  few of them.                      │
│                                     │
│   42 kept · joined Jan 2025        │
│                                     │
│  [ common tags: #dusk #ordinary ]  │
└────────────────────────────────────┘
```

## 13. Blockchain verification presentation

Never shown as a large technical block above the fold. On the publication
reader: a single quiet line under the byline —

```
◈ Kept on Solana · Verified          [ Proof ]
```

Tapping `Proof` opens `BlockchainProofSheet` (bottom sheet, mobile;
side panel, desktop) with, in order: verification result (plain language
first — "This matches what's on the public record" / "We couldn't confirm
this right now, try again shortly" / "This doesn't match the public
record — reported"), then a collapsible technical section (monospace:
publication PDA, transaction signature, network, slot, explorer link).
Plain language always precedes the technical detail; the technical detail
is opt-in, not default-open.

## 14. Accessibility rules (baseline, see UI_IMPLEMENTATION_PLAN.md for QA)

- Touch targets ≥ 44×44px, including icon-only buttons (hit area padding
  even if the visual icon is smaller).
- Never rely on color alone: verification, discoverability, and status
  always pair color with an icon and a text label.
- Viewport meta allows zoom (`user-scalable=yes`, no `maximum-scale=1`).
- Focus-visible outline is never removed, only restyled.
- All bottom sheets and modals trap focus, restore focus to the trigger on
  close, and are dismissible via Escape and a labeled close control.
