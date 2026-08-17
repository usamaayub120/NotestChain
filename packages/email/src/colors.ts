/**
 * Hand-mirrored from apps/web/src/styles/tokens.css's light theme.
 *
 * Email clients don't support CSS custom properties, so these have to be
 * literal hex values rather than `rgb(var(--x))` — and since almost no
 * email client honours `prefers-color-scheme` reliably, every template is
 * designed against light mode only, the same "warm paper" palette the rest
 * of the product uses by default. Keep these in sync with tokens.css by
 * hand if the palette ever changes; nothing enforces that automatically.
 */
export const EMAIL_COLORS = {
  background: "#F6F1E8",
  surface: "#FFFFFF",
  foreground: "#201E1B",
  mutedForeground: "#6F695D",
  muted: "#EDE7DB",
  border: "#DDD5C4",
  primary: "#E1502F",
  primaryForeground: "#FFFFFF",
  verified: "#3F6B4C",
  verifiedForeground: "#F3F7F1",
  destructive: "#C4361F",
} as const;

/**
 * Fonts are self-hosted in the app (no Google Fonts, no CDN — see
 * globals.css) specifically so there's no external network dependency.
 * Email clients can't reliably load arbitrary @font-face files regardless,
 * so templates use the same system-font fallback stack the app itself
 * falls back to when Figtree/Bricolage Grotesque haven't loaded yet.
 */
// Single-quoted font names, deliberately — every use of these sits inside a
// double-quoted HTML `style="..."` attribute (see layout.ts). A double-quoted
// name like "Segoe UI" would terminate that attribute early and corrupt the
// markup for every email; single quotes are equally valid CSS and don't
// collide with it.
export const EMAIL_FONTS = {
  body: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`,
  // Reserved for the same narrow purpose as IBM Plex Mono in the app:
  // transaction signatures, PDAs, hashes — never prose.
  mono: `ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace`,
} as const;
