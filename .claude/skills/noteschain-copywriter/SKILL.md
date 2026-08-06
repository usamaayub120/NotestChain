---
name: noteschain-copywriter
description: Writes and edits every piece of user-facing text on NotesChain — homepage/marketing copy, empty states, error messages, button and CTA labels, confirmation dialogs, toasts, status labels, tooltips, onboarding text, admin-facing microcopy. Matches the site's established quiet-editorial voice (see DESIGN_SYSTEM.md) and actively strips out AI-generated-sounding phrasing — no "unlock/leverage/seamless/elevate," no rule-of-three listing, no marketing enthusiasm, no Web3-landing-page tropes. Use this any time the user asks to write, rewrite, review, or just "fix the wording on" anything a real visitor or reader would see on the site, even if they don't mention copy, voice, or this skill by name — e.g. "what should the empty state say," "add a tooltip here," "this button label feels off," "write something for the new settings page."
---

# NotesChain Copywriter

## Why this skill exists

Left to its own devices, an LLM writing web copy reaches for a specific, recognizable
register: triads ("fast, flexible, and free"), inflated verbs ("unlock," "elevate,"
"empower"), and sentences that all land with the same confident weight. None of that
is *wrong*, exactly — it's just instantly recognizable as generated, and it clashes
hard with what NotesChain is trying to be. Every piece of copy already in this app
was written to sound like one calm, specific person talking, not a product marketing
team. Your job is to keep it that way, whether you're writing the fifth empty state
or the first line of a brand-new page.

## The voice, in one paragraph

NotesChain is a notebook that became public — the feeling of a personal journal that
occasionally lets a thought out into the world, permanently (`DESIGN_SYSTEM.md`).
It sits between a private notes app and a small editorial magazine. The three rules
that govern every sentence on the site:

1. **The words come first.** Chrome, badges, and metadata stay quiet.
2. **Permanence is reassuring, not intimidating.** We say "kept," never "hash,"
   "on-chain," or "verified" in anything a reader sees. The blockchain is a quiet
   proof of keeping, not the headline.
3. **Every screen should feel handwritten-considered, not database-generated.**

Concretely, that means: short declarative sentences, contractions where a person
would use them, warmth without exclamation points, and total avoidance of "Web3
landing page" energy — no neon-green verified pills, no chain-link icons in the
copy's *language* either (don't say "immutable ledger," say "kept").

One thing worth knowing going in: the existing copy is *almost* perfectly consistent
on all of this, except one line in `DraftEditorPage.tsx` — "Approved! Publish it
permanently when you're ready." — which is the one exclamation point in the whole
app. That's a small inconsistency in what's there already, not the standard. Don't
use it as license to add more energy elsewhere.

## The anti-AI-tell checklist

This is the actual point of this skill, so take it seriously. Before you consider
any copy done, read it out loud (mentally) and check it against these. Every one of
these is a *pattern*, not a single banned word — the goal is to notice the shape,
not just grep for a blocklist.

**Inflated verbs.** "Unlock," "elevate," "empower," "leverage," "harness," "supercharge,"
"revolutionize," "transform." NotesChain copy uses plain verbs: keep, write, publish,
find, read. "Publish your way" beats "Unlock your publishing potential" not because
the second one is inaccurate, but because nobody talks like that about their own
journal.

**Rule of three.** "Fast, flexible, and free." "Write, publish, and connect." The
human tell is *not* using three parallel items every time — real people list two
things, or one, or four uneven ones. Look at the actual homepage: three feature
blocks, yes, but each one is a different shape and length ("Drafts stay yours" /
"Publish your way" / "A public record, once you're sure") — not three identically-
structured phrases.

**Manufactured urgency and hedged enthusiasm stacked together.** "Don't miss out on
this seamless experience!" AI copy tends to be simultaneously oversold and over-
qualified. NotesChain copy commits to a plain claim and stops: "Once published,
this content will be stored on a public blockchain." No "seamlessly," no "amazing,"
no soft-pedaling with "may potentially."

**Perfectly parallel sentence structure.** If every sentence in a paragraph is the
same length and shape, it reads like it was generated in one pass. Vary it. Look at
the publish-warning dialog: three sentences of noticeably different length and
weight, not three restatements of the same idea.

**"Whether you're X or Y" and "not just X, but Y."** Both are extremely common LLM
scaffolding for sounding inclusive/comprehensive without saying anything specific.
Cut them. Say the specific thing instead.

**Overexplaining.** "It's important to note that..." / "In today's fast-paced
world..." / "At the end of the day..." These are throat-clearing. NotesChain copy
starts with the actual point: "Nothing's been kept yet" not "It's worth noting that
no publications currently exist in this space."

**Exclamation-point enthusiasm.** One exists in the current app by accident (see
above) — don't add a second one on purpose. Confidence reads calmer without it.

**Title Case Everywhere.** Buttons and labels here are sentence case: "Start
writing," "Explore thoughts," "Set up your public profile" — not "Start Writing"
or "Explore Thoughts."

**Generic superlatives with nothing behind them.** "The best way to..." / "A
powerful new way to..." Say what it actually does instead of asserting that it's
good.

**Em dash overuse as a connective tic.** One or two per longish paragraph is fine
and matches the existing copy's rhythm — but if every second sentence has one, it
starts to read as a stylistic tell rather than a real pause. Vary how you connect
clauses: sometimes a period, sometimes "and," sometimes just two short sentences
back to back.

## Before / after

These aren't templates to fill in — they're here so you can feel the difference
in register, then apply that same judgment to whatever you're actually writing.

| Generic AI instinct | NotesChain voice | Why |
|---|---|---|
| "Unlock the power of decentralized publishing." | "Publish your way." | Plain verb, no inflation, already matches the real homepage copy. |
| "No results found. Try adjusting your search criteria." | "No results" / "Try a different keyword or check the spelling." | Shorter, and "check the spelling" is a specific, human thing to suggest — not generic advice. |
| "This action is irreversible and cannot be undone. Please proceed with caution." | "This will be permanent" / "The publication cannot be edited or deleted after finalization." | States the fact once, plainly, instead of hedging and warning in the same breath. |
| "Great job! Your changes have been saved successfully." | "Saved" | The existing autosave indicator just says "Saved." No congratulations for autosaving. |
| "Discover a world of verified, permanent content, whether you're a casual reader or a dedicated writer." | "Recently kept thoughts." | Cuts the "whether you're X or Y" scaffolding entirely; says what the page actually shows. |
| "We were unable to verify this at this time. Please try again later." | "We couldn't confirm this right now — try again shortly." | Contraction, softer time-frame ("shortly" not "at this time"), no passive-voice distancing. |

## Finding what's already there before writing something new

Don't invent tone from scratch for a new page — NotesChain almost certainly already
has copy in a similar spot, and matching it is both faster and more consistent than
deriving a fresh voice each time. Before writing anything new:

- **Empty states**: grep for `<EmptyState` across `apps/web/src/pages/` — there are a
  dozen-plus existing instances (drafts, bookmarks, search, moderation, audit log,
  blockchain jobs...). Read a few whose context is closest to what you're writing,
  and match their length and rhythm, not just their topic.
- **Error messages**: grep for `<ErrorState` and for the component itself at
  `apps/web/src/components/ErrorState.tsx` — the default is "Something went wrong" /
  "Please try again," and most pages just override the `message` prop with one
  specific sentence about what wasn't found.
- **Confirmations and destructive actions**: look at
  `apps/web/src/components/draft/PublicationWarningDialog.tsx` for the register used
  when something is genuinely irreversible — plain statement of fact, no scare
  language, one checkbox acknowledging it.
- **Status/progress text**: `apps/web/src/components/draft/AutosaveIndicator.tsx` and
  the draft status labels in `apps/web/src/pages/drafts/DraftsListPage.tsx` show how
  the app talks about its own background state — short, present-tense, no jargon.
- **Blockchain-adjacent copy specifically**: `apps/web/src/components/publication/BlockchainProofSheet.tsx`'s
  `STATE_MESSAGES` is the canonical example of translating a technical state into
  the "kept" register. If you're writing anything that touches verification,
  publishing, or the chain, read this file first — it's the clearest existing
  demonstration of rule #2 above.
- **Brand constants**: `packages/shared/src/brand.ts` has the canonical name,
  tagline, and one-line description. Never restate the tagline with different
  wording elsewhere — reuse it.
- **The full palette/motif reasoning**: `DESIGN_SYSTEM.md` §1–2 and §6 (the Kept
  Stamp) if you want the complete argument behind the voice, not just the summary
  above.

## Process

1. **Locate similar existing copy** using the grep patterns above. If this exact
   *kind* of copy (another empty state, another confirmation dialog) already exists
   three times in the app, you're matching an established pattern, not inventing one.
2. **Draft the copy.** Default to the shortest version that says the specific thing —
   cut before you add.
3. **Run it against the anti-AI-tell checklist** above. Read it as if a stranger
   wrote it in five minutes and will never see it again — does it sound like that,
   or like someone who actually thinks about this product wrote it?
4. **Check word choice against rule #2** specifically if the copy touches
   verification/publishing/the chain at all — "kept," not "hash"; "the public
   record," not "the blockchain," in anything a reader sees (technical terms are
   fine in a "Technical details" disclosure, same pattern as `BlockchainProofSheet`).
5. **Place it correctly** — sentence case for labels/buttons, contractions where a
   person would use them, and match the surrounding component's existing prop
   structure (most take a `title`/`description` pair, or a single `message`).

## When you're done

Say what you wrote and where it goes, briefly — you don't need to re-explain the
voice rules you just applied. If you had to make a judgment call between two
reasonable options (e.g. two ways to phrase an empty state), it's fine to mention
the alternative briefly, but don't hedge the whole answer.
