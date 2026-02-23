/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          950: '#050608', // Ultra dark background
          900: '#0a0b0d', // Secondary panel background
          800: '#13151a', // Card background
          700: '#1e2128', // Border color
        },
        accent: '#3b82f6', // Primary accent color (blue)
        'accent-light': '#60a5fa', // Lighter blue
        'accent-dark': '#2563eb', // Darker blue
        success: '#10b981', // Success/profit green
        danger: '#ef4444', // Loss/danger red
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
}
