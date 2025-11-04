
import type { Config } from "tailwindcss"
export default {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#1c6dd0", foreground: "#ffffff" }
      },
      borderRadius: { "2xl": "1.25rem" }
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config
