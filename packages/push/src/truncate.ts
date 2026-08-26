/**
 * A moderation note can run up to 2000 characters (LIMITS.MODERATION_NOTE_MAX_LENGTH
 * in @noteschain/shared — not imported here to keep this package dependency-free);
 * a push notification body has no business showing all of it. Truncates on a
 * word boundary where possible so the cut doesn't land mid-word.
 */
export function truncateForPush(text: string, maxLength = 140): string {
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  return `${lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut}…`;
}
