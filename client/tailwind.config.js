/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        rgukt: {
          50: '#f0fdf4',
          500: '#15803d',
          700: '#166534',
          900: '#14532d',
          navy: '#0f172a'
        }
      }
    },
  },
  plugins: [],
}

