/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [ "./**/*.html", "./**/*.templ", "./**/*.go", ],
  theme: {},
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
