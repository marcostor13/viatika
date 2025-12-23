/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts,scss}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', 'sans-serif'], // Set DM Sans as default sans font
      },
      colors: {
        primary: '#0e8ee1',
        secondary: '#1B2559',
        tertiary: '#A3AED0',
        quaternary: '#FFFFFF',
        background: '#F4F7FE',
        success: '#05CD99',
        warning: '#FFB547',
        error: '#EE5D50',
        // Brand specific shades if needed later
        brand: {
          100: '#F4F7FE',
          200: '#E9EDF7',
          // ...
        }
      },
      borderRadius: {
        'xl': '20px', // Standard card radius
        '2xl': '30px',
        '3xl': '40px'
      },
      boxShadow: {
        'soft': '0 20px 25px -5px rgba(112, 144, 176, 0.12)', // Venus style shadow
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
};
