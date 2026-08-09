import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // rgb(var(--x) / <alpha-value>) — not a bare var(--x) — is what lets
        // Tailwind's opacity modifiers (bg-background/95, bg-destructive/10,
        // hover:bg-primary/90, ...) actually apply an alpha channel. It
        // requires tokens.css to define each variable as space-separated
        // "R G B" channels rather than a hex string; see tokens.css's header
        // comment. <alpha-value> defaults to 1 when no modifier is used, so
        // this is safe for every plain (non-opacity) usage too.
        background: "rgb(var(--background) / <alpha-value>)",
        foreground: "rgb(var(--foreground) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        "surface-elevated": "rgb(var(--surface-elevated) / <alpha-value>)",
        primary: {
          DEFAULT: "rgb(var(--primary) / <alpha-value>)",
          foreground: "rgb(var(--primary-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "rgb(var(--muted) / <alpha-value>)",
          foreground: "rgb(var(--muted-foreground) / <alpha-value>)",
        },
        border: "rgb(var(--border) / <alpha-value>)",
        input: "rgb(var(--input) / <alpha-value>)",
        ring: "rgb(var(--ring) / <alpha-value>)",
        success: "rgb(var(--success) / <alpha-value>)",
        warning: "rgb(var(--warning) / <alpha-value>)",
        destructive: {
          DEFAULT: "rgb(var(--destructive) / <alpha-value>)",
          foreground: "rgb(var(--destructive-foreground) / <alpha-value>)",
        },
        verified: {
          DEFAULT: "rgb(var(--verified) / <alpha-value>)",
          foreground: "rgb(var(--verified-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          foreground: "rgb(var(--accent-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "rgb(var(--secondary) / <alpha-value>)",
          foreground: "rgb(var(--secondary-foreground) / <alpha-value>)",
        },
        card: {
          DEFAULT: "rgb(var(--card) / <alpha-value>)",
          foreground: "rgb(var(--card-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "rgb(var(--popover) / <alpha-value>)",
          foreground: "rgb(var(--popover-foreground) / <alpha-value>)",
        },
        canopy: {
          DEFAULT: "rgb(var(--canopy) / <alpha-value>)",
          foreground: "rgb(var(--canopy-foreground) / <alpha-value>)",
        },
        glow: "rgb(var(--glow) / <alpha-value>)",
      },
      fontFamily: {
        display: ["Bricolage Grotesque", "system-ui", "sans-serif"],
        sans: ["Figtree", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
      },
      maxWidth: {
        reading: "72ch",
      },
      fontSize: {
        // Tracking is size-specific, never one flat value (apple-design
        // typography: small text wants slight positive tracking for
        // legibility, large display text wants negative tracking as
        // letterforms read too far apart at that size).
        xs: ["0.8125rem", { lineHeight: "1.25", letterSpacing: "0.01em" }],
        sm: ["0.9375rem", { lineHeight: "1.4", letterSpacing: "0.005em" }],
        base: ["1rem", { lineHeight: "1.6", letterSpacing: "0" }],
        body: ["1.0625rem", { lineHeight: "1.65", letterSpacing: "0" }],
        lg: ["1.125rem", { lineHeight: "1.4", letterSpacing: "-0.005em" }],
        xl: ["1.375rem", { lineHeight: "1.3", letterSpacing: "-0.01em" }],
        "2xl": ["1.75rem", { lineHeight: "1.2", letterSpacing: "-0.015em" }],
        "3xl": ["2.25rem", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
      },
      keyframes: {
        // Ambient hero light — a very slow, small drift, never a full loop
        // you'd consciously notice, just enough to feel like light moving
        // through leaves rather than a static gradient.
        drift: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "50%": { transform: "translate(4%, -3%) scale(1.06)" },
        },
        "drift-reverse": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "50%": { transform: "translate(-3%, 4%) scale(1.08)" },
        },
        draw: {
          from: { strokeDashoffset: "var(--dash-length)" },
          to: { strokeDashoffset: "0" },
        },
        // Kept Stamp, "confirming" state (DESIGN_SYSTEM.md §6) — a slow opacity
        // pulse. The 0%→100% (not a round-trip) range matters: under
        // prefers-reduced-motion the global rule forces a single iteration,
        // which then lands and holds at the 60% end-state via forwards fill,
        // giving exactly the documented "static at 60% opacity" fallback.
        "kept-pulse": {
          "0%": { opacity: "1" },
          "100%": { opacity: "0.6" },
        },
        // Kept Stamp, "verified" state — single scale-from-0.85 + fade-in.
        "kept-in": {
          "0%": { opacity: "0", transform: "scale(0.85)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        drift: "drift 50s ease-in-out infinite",
        "drift-reverse": "drift-reverse 65s ease-in-out infinite",
        draw: "draw 1.4s ease-out forwards",
        "kept-pulse": "kept-pulse 1.2s ease-in-out infinite alternate forwards",
        "kept-in": "kept-in 220ms cubic-bezier(0.32,0.72,0,1) forwards",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
