import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        heading: ["var(--font-heading)"],
        body: ["var(--font-body)"],
        mono: ["var(--font-mono)"],
      },
      colors: {
        app:            "var(--bg-app)",
        surface:        "var(--bg-surface)",
        elevated:       "var(--bg-elevated)",
        input:          "var(--bg-input)",
        "nk-border":    "var(--border)",
        accent:         "var(--accent)",
        "accent-hover": "var(--accent-hover)",
        "user-bubble":  "var(--user-bubble)",
        primary:        "var(--text-primary)",
        muted:          "var(--text-muted)",
        disabled:       "var(--text-disabled)",
      },
    },
  },
  plugins: [],
} satisfies Config;
