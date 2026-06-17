import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: "hsl(var(--card))",
        border: "hsl(var(--border))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
        moss: "hsl(var(--moss))",
        sand: "hsl(var(--sand))",
        water: "hsl(var(--water))"
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "Cambria", "\"Times New Roman\"", "serif"],
        sans: ["var(--font-sans)", "system-ui", "-apple-system", "BlinkMacSystemFont", "\"Segoe UI\"", "sans-serif"],
        mono: ["var(--font-mono)", "\"SFMono-Regular\"", "\"Roboto Mono\"", "Consolas", "\"Liberation Mono\"", "monospace"]
      },
      boxShadow: {
        soft: "0 18px 60px -28px rgb(9 46 53 / 0.45)"
      }
    }
  },
  plugins: []
};

export default config;
