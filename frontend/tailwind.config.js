/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        arista: {
          50:  '#eef3fb',   // very light blue-gray
          100: '#d0def4',   // light periwinkle
          200: '#a1bde9',   // soft sky blue
          300: '#6b96db',   // vibrant medium blue
          400: '#3d72c9',   // strong blue
          500: '#1a56b0',   // rich blue (primary action color)
          600: '#0e2e5b',   // Arista brand navy (logo color)
          700: '#0b2448',   // dark navy
          800: '#081a35',   // very dark
          900: '#051123',   // near-black
        },
      },
      keyframes: {
        indeterminate: {
          '0%':   { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(350%)' },
        },
      },
      animation: {
        indeterminate: 'indeterminate 1.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
