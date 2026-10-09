/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Portal palette: restrained navy, matching the public website's placeholder primary (#1F3A5F).
        brand: {
          50: '#f1f5fa',
          100: '#dbe5f1',
          200: '#b3c8e0',
          300: '#7c9dc7',
          400: '#4a73a6',
          500: '#2d5384',
          600: '#1F3A5F',
          700: '#182e4c',
          800: '#12233a',
          900: '#0e1c2f',
          950: '#0a131f',
        },
        college: {
          primary: 'rgb(var(--c-primary) / <alpha-value>)',
          secondary: 'rgb(var(--c-secondary) / <alpha-value>)',
          accent: 'rgb(var(--c-accent) / <alpha-value>)',
        },
        ink: {
          900: '#0b0f1a',
          800: '#121729',
          700: '#1a2036',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Georgia', 'Cambria', '"Times New Roman"', 'serif'],
      },
      boxShadow: {
        soft: '0 1px 2px 0 rgba(16,24,40,0.04), 0 1px 3px 0 rgba(16,24,40,0.06)',
        card: '0 4px 24px -4px rgba(16,24,40,0.10)',
      },
      backdropBlur: {
        xs: '2px',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0, transform: 'translateY(4px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        gradientMove: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        floatOrb: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '50%': { transform: 'translate(8px, -10px) scale(1.08)' },
        },
        shimmerText: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.55 },
        },
      },
      animation: {
        fadeIn: 'fadeIn .25s ease-out',
        gradientMove: 'gradientMove 8s ease infinite',
        floatOrb: 'floatOrb 6s ease-in-out infinite',
        floatOrbDelay: 'floatOrb 7s ease-in-out infinite 1.2s',
        shimmerText: 'shimmerText 3.5s linear infinite',
        pulseSoft: 'pulseSoft 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
