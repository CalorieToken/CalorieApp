import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // CalorieToken branding
        "brand-primary": "#008D36",
        "brand-accent": "#f9b233",
        "brand-secondary": "#505BA9",
        "brand-bg": "#F5F5F5",
        // Legacy colors (kept for compatibility)
        shell: "#f7f4ef",
        ink: "#1d2b36",
        accent: "#2f7d5d",
        warm: "#e69a57"
      }
    }
  },
  plugins: []
};

export default config;
