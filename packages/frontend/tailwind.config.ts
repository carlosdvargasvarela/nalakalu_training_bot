import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        app:            "var(--bg-app)",
        surface:        "var(--bg-surface)",
        elevated:       "var(--bg-elevated)",
        "bg-input":     "var(--bg-input)",
        "nk-border":    "var(--border)",
        accent:         "var(--accent)",
        "accent-h":     "var(--accent-hover)",
        "user-bubble":  "var(--user-bubble)",
        primary:        "var(--text-primary)",
        muted:          "var(--text-muted)",
        "txt-disabled": "var(--text-disabled)",
      },
    },
  },
  plugins: [],
} satisfies Config;
