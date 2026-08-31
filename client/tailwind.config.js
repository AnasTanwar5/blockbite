/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0fdf4",
          100: "#dcfce7",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          accent: "#10b981",
          gold: "#f59e0b",
          neon: "#00ff9d",
        },
        dark: {
          bg: "#090d16",
          card: "#111827",
          border: "#1f293d",
          hover: "#1e293b",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 25px -5px rgba(34, 197, 94, 0.3)",
        "glow-gold": "0 0 25px -5px rgba(245, 158, 11, 0.3)",
      },
    },
  },
  plugins: [],
};
