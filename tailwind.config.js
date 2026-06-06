/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        karatsu: {
          // 唐津焼・玄界灘をイメージした藍系
          50: "#f0f6fb",
          100: "#dbe9f4",
          600: "#1e6fb0",
          700: "#175a8f",
          800: "#13486f",
          900: "#0f3a59",
        },
      },
    },
  },
  plugins: [],
};
