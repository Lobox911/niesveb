import type { Config } from "tailwindcss";

/* Seven colours. Nothing else.
   Values live in shared/globals-tokens.css as CSS variables so there is
   exactly one place to change them. Do not add hex values here. */

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    // NOTE: `colors` replaces Tailwind's defaults rather than extending them.
    // This is deliberate — it makes `bg-gray-100` a build error instead of a
    // silent eighth colour. Three separate palettes crept into this project
    // before this was locked down.
    colors: {
      transparent: "transparent",
      current: "currentColor",
      white: "rgb(var(--white-rgb) / <alpha-value>)",
      ink: "rgb(var(--ink-rgb) / <alpha-value>)",
      green: "rgb(var(--green-rgb) / <alpha-value>)",
      gold: "rgb(var(--gold-rgb) / <alpha-value>)",
      paper: "rgb(var(--paper-rgb) / <alpha-value>)",
      line: "rgb(var(--line-rgb) / <alpha-value>)",
      muted: "rgb(var(--muted-rgb) / <alpha-value>)",
      danger: "rgb(var(--danger-rgb) / <alpha-value>)",
    },
    extend: {
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
        mono: ["var(--font-mono)"],
      },
      borderRadius: {
        DEFAULT: "4px", // universal, per the system
      },
      maxWidth: {
        content: "1120px",
        prose: "68ch",
      },
      spacing: {
        gutter: "20px",
      },
      boxShadow: {
        // The system rejects shadows; depth comes from 1px borders on white
        // over paper. Everything maps to none so a stray `shadow-lg` is inert.
        none: "none",
        sm: "none",
        DEFAULT: "none",
        md: "none",
        lg: "none",
        xl: "none",
        "2xl": "none",
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};

export default config;
