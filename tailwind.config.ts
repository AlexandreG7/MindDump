import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        tone: {
          todo: { DEFAULT: "hsl(var(--tone-todo))", soft: "hsl(var(--tone-todo-soft))", ink: "hsl(var(--tone-todo-ink))" },
          list: { DEFAULT: "hsl(var(--tone-list))", soft: "hsl(var(--tone-list-soft))", ink: "hsl(var(--tone-list-ink))" },
          meal: { DEFAULT: "hsl(var(--tone-meal))", soft: "hsl(var(--tone-meal-soft))", ink: "hsl(var(--tone-meal-ink))" },
          agenda: { DEFAULT: "hsl(var(--tone-agenda))", soft: "hsl(var(--tone-agenda-soft))", ink: "hsl(var(--tone-agenda-ink))" },
        },
      },
      keyframes: {
        "check-pop": { "0%": { transform: "scale(0.82)" }, "60%": { transform: "scale(1.08)" }, "100%": { transform: "scale(1)" } },
        "row-in": { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "translateY(0)" } },
      },
      animation: {
        "check-pop": "check-pop 200ms ease-out",
        "row-in": "row-in 220ms ease-out both",
      },
      boxShadow: {
        surface: "var(--shadow-surface)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [
    // `touch:` cible les écrans sans survol (téléphones, tablettes) : les
    // actions révélées au survol y restent visibles.
    plugin(({ addVariant }) => {
      addVariant("touch", "@media (hover: none)");
    }),
  ],
};

export default config;
