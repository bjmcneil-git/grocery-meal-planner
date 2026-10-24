import type { Config } from "tailwindcss";

// Colors come from the active palette's CSS variables (app/globals.css), so
// every page follows the color set picked in the App colors sheet.
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        app: token("bg"),
        card: token("card"),
        ink: token("ink"),
        dim: token("dim"),
        line: token("line"),
        accent: {
          DEFAULT: token("accent"),
          ink: token("accent-ink"),
          soft: token("accent-soft"),
          "soft-ink": token("accent-soft-ink"),
        },
        second: {
          DEFAULT: token("second"),
          soft: token("second-soft"),
          "soft-ink": token("second-soft-ink"),
        },
        third: {
          soft: token("third-soft"),
          ink: token("third-ink"),
        },
        danger: token("danger"),
      },
      backgroundImage: {
        hero: "linear-gradient(135deg, rgb(var(--grad1)) 0%, rgb(var(--grad2)) 100%)",
      },
      boxShadow: {
        soft: "0 6px 18px rgba(20, 30, 40, 0.06)",
        lift: "0 8px 18px rgba(20, 30, 40, 0.16)",
        hero: "0 10px 22px rgba(20, 30, 40, 0.18)",
      },
      fontFamily: {
        sans: ["var(--font-nunito)", "ui-rounded", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
