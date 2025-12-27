/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    colors: {
        transparent: 'transparent',
        current: 'currentColor',
        'primary': colors.blue,
        'secondary': colors.green,
        'neutral': colors.gray,
    },
  variants: {
    extend: {
       
      }
    },
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  plugins: [],
};


