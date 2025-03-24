/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'superfluid-blue': '#4F46E5',
        'superfluid-indigo': '#6366F1',
      },
    },
  },
  plugins: [],
} 