/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Portal palette: restrained navy, matching the public website's placeholder primary (#1F3A5F).
        // Portal palette: deep navy + clear blue, aligned with the public site tokens.
        brand: {
          50: '#EAF1FF',
          100: '#D9E6FF',
          200: '#B5CDFF',
          300: '#86AEFF',
          400: '#5189FF',
          500: '#2F6FF5',
          600: '#1F5BDB',
          700: '#1A4AB3',
          800: '#172747',
          900: '#101D35',
          950: '#0A1326',
        },
        college: {
          primary: 'rgb(var(--c-primary) / <alpha-value>)',
          secondary: 'rgb(var(--c-secondary) / <alpha-value>)',
          accent: 'rgb(var(--c-accent) / <alpha-value>)',
        },
        ink: {
          900: '#101D35',
          800: '#172747',
          700: '#26385C',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Manrope', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        display: ['clamp(2.5rem, 1.6rem + 4.2vw, 4.5rem)', { lineHeight: '1.04', letterSpacing: '-0.03em', fontWeight: '700' }],
        h1: ['clamp(2rem, 1.4rem + 2.6vw, 3.25rem)', { lineHeight: '1.08', letterSpacing: '-0.025em', fontWeight: '700' }],
        h2: ['clamp(1.625rem, 1.3rem + 1.5vw, 2.5rem)', { lineHeight: '1.15', letterSpacing: '-0.02em', fontWeight: '700' }],
        h3: ['clamp(1.125rem, 1.05rem + 0.4vw, 1.375rem)', { lineHeight: '1.3', letterSpacing: '-0.01em', fontWeight: '700' }],
        lead: ['clamp(1.0625rem, 1rem + 0.35vw, 1.25rem)', { lineHeight: '1.65' }],
      },
      borderRadius: {
        xs: 'var(--r-xs)', sm: 'var(--r-sm)', DEFAULT: 'var(--r-sm)', md: 'var(--r-md)',
        lg: 'var(--r-md)', xl: 'var(--r-lg)', '2xl': 'var(--r-xl)', '3xl': 'var(--r-2xl)',
      },
      maxWidth: { content: '72rem', prose: '42rem' },
      boxShadow: {
        soft: 'var(--sh-1)',
        card: 'var(--sh-2)',
        float: 'var(--sh-3)',
        pop: 'var(--sh-4)',
        hero: 'var(--sh-5)',
      },
      transitionTimingFunction: { out: 'cubic-bezier(.22,.8,.3,1)' },
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
