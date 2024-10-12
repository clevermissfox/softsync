/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        inter: ["Inter", "sans-serif"],
      },
      keyframes: {
        loading: {
          "100%": {
            transform: "rotate(360deg)",
          },
        },
      },
      animation: {
        loading: "loading 500ms linear infinite",
      },
    },
  },
  plugins: [],
};
