import type { Config } from "tailwindcss";

export default {
  content: ["./client/index.html", "./client/src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // 97.7 THE FLAME BRAND COLORS
        brand: {
          gold: "#FFD700",
          amber: "#FFBF00",
          flame: "#FF4500",
        }
      },
    },
  },
  plugins: [], // Removed the broken typography plugin
} satisfies Config;
