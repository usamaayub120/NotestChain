/**
 * Every interpolated value in a template goes through this first — publication
 * titles, moderator-typed reasons, and comment bodies are all user- or
 * moderator-supplied text with no HTML sanitisation guarantee upstream, and
 * these strings get concatenated straight into an HTML string (no JSX, no
 * DOM, nothing else standing between the value and the wire). Skipping this
 * on any interpolation is a real injection hole into an HTML email, not a
 * cosmetic risk.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
