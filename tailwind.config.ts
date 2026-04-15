/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: "#07090f",
          panel: "#0b1220",
          card: "#0f1828",
        },
        border: {
          DEFAULT: "#16243a",
          strong: "#1e3050",
        },
        accent: "#2563eb",
        green: {
          DEFAULT: "#22c55e",
          dim: "#052e16",
        },
        red: {
          DEFAULT: "#ef4444",
          dim: "#2d0707",
        },
        yellow: "#f59e0b",
        purple: "#8b5cf6",
        blue: {
          DEFAULT: "#3b82f6",
          muted: "#93c5fd",
        },
      },
      fontFamily: {
        sans: ["IBM Plex Sans Thai", "IBM Plex Sans", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
