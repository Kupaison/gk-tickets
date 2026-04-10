/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "brand-black": "#070707",
        "brand-dark":  "#0d0d0d",
        "brand-green": "#39FF14",
        "brand-gold":  "#D4AF37",
        "brand-muted": "#888888",
      },
      keyframes: {
        scanline: {
          "0%":   { top: "4px",   opacity: 1 },
          "50%":  { opacity: 0.6 },
          "100%": { top: "calc(100% - 4px)", opacity: 1 },
        },
      },
      animation: {
        scanline: "scanline 2s ease-in-out infinite alternate",
      },
    },
  },
  plugins: [],
};
