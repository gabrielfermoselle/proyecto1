import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const token = (nombre: string) => `hsl(var(--${nombre}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "1rem", screens: { "2xl": "1160px" } },
    extend: {
      colors: {
        border: token("border"),
        input: token("input"),
        ring: token("ring"),
        background: token("background"),
        foreground: token("foreground"),
        primary: {
          DEFAULT: token("primary"),
          foreground: token("primary-foreground"),
          soft: token("primary-soft"),
        },
        secondary: {
          DEFAULT: token("secondary"),
          foreground: token("secondary-foreground"),
          muted: token("secondary-muted"),
        },
        destructive: { DEFAULT: token("destructive"), foreground: token("destructive-foreground") },
        muted: { DEFAULT: token("muted"), foreground: token("muted-foreground") },
        accent: {
          DEFAULT: token("accent"),
          foreground: token("accent-foreground"),
          hover: token("accent-hover"),
          "on-dark": token("accent-on-dark"),
        },
        rating: token("rating"),
        card: { DEFAULT: token("card"), foreground: token("card-foreground") },
        popover: { DEFAULT: token("popover"), foreground: token("popover-foreground") },
        success: { DEFAULT: token("success"), foreground: token("success-foreground") },
        warning: { DEFAULT: token("warning"), foreground: token("warning-foreground") },
      },
      borderRadius: { lg: "var(--radius)", md: "calc(var(--radius) - 2px)", sm: "calc(var(--radius) - 4px)" },
      boxShadow: {
        // Sombras frías (tinta azulada), con desplazamiento y desenfoque: profundidad, no halo.
        sm: "0 1px 2px 0 rgb(15 23 42 / 0.06), 0 1px 3px 0 rgb(15 23 42 / 0.05)",
        md: "0 4px 12px -2px rgb(15 23 42 / 0.10), 0 2px 4px -2px rgb(15 23 42 / 0.06)",
        lg: "0 12px 28px -8px rgb(15 23 42 / 0.16), 0 4px 8px -4px rgb(15 23 42 / 0.06)",
        xl: "0 24px 48px -16px rgb(15 23 42 / 0.28), 0 8px 16px -8px rgb(15 23 42 / 0.10)",
      },
      fontFamily: {
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        heading: ["var(--font-heading)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [animate],
};

export default config;
