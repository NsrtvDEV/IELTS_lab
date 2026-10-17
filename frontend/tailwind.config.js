/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#dce8ff",
          200: "#bfd5ff",
          300: "#93b8ff",
          400: "#5f93ff",
          500: "#2f6bff",
          600: "#1f5af0",
          700: "#1848c8",
          800: "#193ea1",
          900: "#1a387f",
        },
        ink: {
          DEFAULT: "#0b1a46", // заголовки
          muted: "#5b6782", // вторичный текст
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans Variable"', "system-ui", "sans-serif"],
        hand: ['"Caveat"', "cursive"],
      },
      boxShadow: {
        card: "0 10px 40px -12px rgba(15, 40, 100, 0.12)",
      },
    },
  },
  plugins: [],
};
