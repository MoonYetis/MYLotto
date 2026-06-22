import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: "#0f0f1e",
          card: "#1e293b",
        },
        gold: {
          DEFAULT: "#f59e0b",
          glow: "rgba(245,158,11,0.4)",
        },
        red: {
          DEFAULT: "#ef4444",
          glow: "rgba(239,68,68,0.4)",
        },
        green: "#10b981",
        muted: {
          DEFAULT: "#64748b",
          light: "#94a3b8",
        },
        border: "#334155",
      },
    },
  },
  plugins: [],
};

export default config;
