/**
 * Original short lines written in NotesChain's own voice — illustrative
 * copy, not real published content, and never presented with a fake
 * author or avatar (see .claude/skills/noteschain-copywriter). Used across
 * the homepage gallery, the footer, and the auth side panel so the same
 * small set of lines feels like a consistent thread through the site
 * rather than one-off marketing filler.
 */
export const KEPT_THOUGHTS: readonly string[] = [
  "The mountain doesn't perform for anyone. Neither should this.",
  "I used to delete things I was embarrassed by. Now I just let them get older.",
  "Some thoughts aren't for anyone. I keep them anyway.",
  "You don't remember most days. This is for the ones you'd want to.",
  "Wrote this on a bench. Still true from here.",
  "Half of what I write is wrong by morning. I keep it anyway — it was true when I meant it.",
  "A good thought doesn't need an audience to be worth keeping.",
  "Somewhere between a diary and a headstone. I like that about this.",
];

export function pickKeptThought(seed: number): string {
  const index = Math.abs(seed) % KEPT_THOUGHTS.length;
  return KEPT_THOUGHTS[index]!;
}
