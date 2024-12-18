const theme = require('./styles/theme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./**/*.html", "./**/*.templ", "./**/*.go"],
  theme: {
    extend: {
      ...theme,
      container: {
        center: true,
        padding: {
          DEFAULT: '1rem',
          sm: '2rem',
          lg: '4rem',
          xl: '5rem',
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    function({ addComponents }) {
      addComponents({
        '.btn': {
          padding: '0.5rem 1rem',
          borderRadius: '0.375rem',
          transition: 'all 0.2s',
          '&:hover': {
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          },
        },
        '.btn-primary': {
          backgroundColor: 'var(--primary-color)',
          color: '#ffffff',
          '&:hover': {
            backgroundColor: 'var(--primary-hover-color)',
          },
        },
        '.card': {
          backgroundColor: '#ffffff',
          borderRadius: '0.5rem',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
          padding: '1.5rem',
        },
        '.nav-link': {
          color: 'var(--secondary-color)',
          transition: 'color 0.2s',
          '&:hover': {
            color: 'var(--primary-color)',
          },
        },
      });
    },
  ],
};
