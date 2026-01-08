/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#0a1628',
          800: '#0d1d35',
          700: '#142744',
        },
        gold: {
          DEFAULT: '#d4af37',
          light: '#e5c158',
          dark: '#b8962f',
        },
      },
    },
  },
  plugins: [],
};
