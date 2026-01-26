/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#233e4f",
          secondary: "#8ad0f3",
        },
        ui: {
          bg: "#f6f8f9",
          panel: "#ffffff",
          border: "#d9e0e4",
          text: "#1b1b1b",
          sub: "#4f5b67",
        },
      },
      borderRadius: {
        xl: "14px",
        "2xl": "20px",
      },
      boxShadow: {
        card: "0 4px 14px rgba(0,0,0,0.1)",
      },
    },
  },
  plugins: [],
}