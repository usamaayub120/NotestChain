import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        surface: "var(--surface)",
        "surface-elevated": "var(--surface-elevated)",
        primary: { DEFAULT: "var(--primary)", foreground: "var(--primary-foreground)" },
        muted: { DEFAULT: "var(--muted)", foreground: "var(--muted-foreground)" },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        success: "var(--success)",
        warning: "var(--warning)",
        destructive: { DEFAULT: "var(--destructive)", foreground: "var(--destructive-foreground)" },
        verified: { DEFAULT: "var(--verified)", foreground: "var(--verified-foreground)" },
        accent: { DEFAULT: "var(--accent)", foreground: "var(--accent-foreground)" },
        secondary: { DEFAULT: "var(--secondary)", foreground: "var(--secondary-foreground)" },
        card: { DEFAULT: "var(--card)", foreground: "var(--card-foreground)" },
        popover: { DEFAULT: "var(--popover)", foreground: "var(--popover-foreground)" },
        canopy: { DEFAULT: "var(--canopy)", foreground: "var(--canopy-foreground)" },
        glow: "var(--glow)",
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
        xs: ["0.8125rem", { lineHeight: "1.25" }],
        sm: ["0.9375rem", { lineHeight: "1.4" }],
        base: ["1rem", { lineHeight: "1.6" }],
        body: ["1.0625rem", { lineHeight: "1.65" }],
        lg: ["1.125rem", { lineHeight: "1.4" }],
        xl: ["1.375rem", { lineHeight: "1.3" }],
        "2xl": ["1.75rem", { lineHeight: "1.2" }],
        "3xl": ["2.25rem", { lineHeight: "1.1" }],
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
      },
      animation: {
        drift: "drift 50s ease-in-out infinite",
        "drift-reverse": "drift-reverse 65s ease-in-out infinite",
        draw: "draw 1.4s ease-out forwards",
      },
    },
  },
  plugins: [],
} satisfies Config;
