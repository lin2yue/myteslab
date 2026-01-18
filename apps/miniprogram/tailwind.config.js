/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        tesla: {
          dark: '#111111',
          black: '#000000',
          gray: '#222222',
          red: '#E82127',
          lightgray: '#3e3e3e',
        }
      }
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false,
  }
}
