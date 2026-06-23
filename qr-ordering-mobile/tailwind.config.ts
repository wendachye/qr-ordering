import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand accent driven by CSS variables (themed per-tenant at runtime via
        // lib/theme.ts). RGB channels + <alpha-value> so `/opacity` modifiers
        // (e.g. bg-accent/20) keep working; the literals are the emerald fallback.
        accent: {
          DEFAULT: "rgb(var(--accent-rgb, 5 150 105) / <alpha-value>)",
          dark: "rgb(var(--accent-dark-rgb, 4 120 87) / <alpha-value>)",
          light: "rgb(var(--accent-light-rgb, 16 185 129) / <alpha-value>)",
          fg: "rgb(var(--accent-fg-rgb, 255 255 255) / <alpha-value>)",
        },
      },
      maxWidth: {
        app: "480px",
      },
    },
  },
  plugins: [],
};

export default config;
