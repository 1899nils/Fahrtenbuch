/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'accent-blue': '#0A84FF',
        'neon-green': '#32D74B',
        'neon-magenta': '#FF375F',
        'bg-dark': '#000000',
      },
      backdropBlur: {
        '3xl': '35px',
      },
    },
  },
  plugins: [],
};
