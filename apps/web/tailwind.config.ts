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
          DEFAULT: "#0a0414",
          card: "#1a0b2e",
          elevated: "#16213e",
        },
        neon: {
          pink: "#ec4899",
          cyan: "#22d3ee",
          yellow: "#facc15",
          purple: "#a78bfa",
          green: "#10b981",
          red: "#ef4444",
        },
        muted: {
          DEFAULT: "#64748b",
          light: "#94a3b8",
        },
        border: "#334155",
      },
      backgroundImage: {
        "vegas-main":
          "linear-gradient(135deg, #1a0b2e 0%, #16213e 50%, #0f3460 100%)",
        "vegas-diagonal":
          "repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(236,72,153,0.04) 20px, rgba(236,72,153,0.04) 40px)",
        "cta-gradient":
          "linear-gradient(135deg, #ec4899, #22d3ee)",
        "balota-pink":
          "linear-gradient(145deg, #ec4899, #be185d)",
        "balota-cyan":
          "linear-gradient(145deg, #22d3ee, #0891b2)",
        "balota-yellow":
          "linear-gradient(145deg, #facc15, #eab308)",
        "neon-divider":
          "linear-gradient(90deg, transparent, rgba(236,72,153,0.5), rgba(34,211,238,0.5), transparent)",
      },
      boxShadow: {
        "glow-pink": "0 0 25px rgba(236,72,153,0.6)",
        "glow-cyan": "0 0 25px rgba(34,211,238,0.6)",
        "glow-yellow": "0 0 20px rgba(250,204,21,0.6)",
        "glow-purple": "0 0 15px rgba(167,139,250,0.5)",
        "glow-green": "0 0 15px rgba(16,185,129,0.5)",
        "cta": "0 0 25px rgba(236,72,153,0.6), 0 4px 20px rgba(0,0,0,0.4)",
      },
    },
  },
  plugins: [],
};

export default config;
