/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Lavender — primary accent (links, soft highlights, focus rings)
        brand: {
          50:  '#f4f2fe',
          100: '#ebe7fd',
          200: '#d9d2fb',
          300: '#c1b6f7',
          400: '#a99bf0',
          500: '#7f6ce4',
          600: '#6a57d2',
          700: '#5848b5',
          800: '#473b92',
          900: '#393073',
          950: '#221d47',
        },
        // Lime — signature fill (primary actions, active states). Use as a background, not as text.
        accent: {
          50:  '#fbfee9',
          100: '#f5fcc9',
          200: '#ecf99d',
          300: '#e2f57c',
          400: '#d4f06b',
          500: '#bcdc3f',
          600: '#93b01f',
          700: '#6f8619',
          800: '#566818',
          900: '#465518',
        },
        // Ink — near-black surfaces
        ink: {
          DEFAULT: '#0b0b0c',
          800: '#1b1b1d',
          700: '#232326',
        },
        // Neutral greys replace the blue-tinted slate scale app-wide
        slate: {
          50:  '#f3f3f1',
          100: '#efefed',
          200: '#e4e4e1',
          300: '#d0d0cc',
          400: '#8b8b87',
          500: '#747471',
          600: '#565654',
          700: '#3d3d3c',
          800: '#262627',
          900: '#18181a',
          950: '#0b0b0c',
        },
        emerald: {
          50:  '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
          950: '#022c22',
        },
        surface: {
          light: '#e9e9e7',
          dark:  '#050506',
        },
      },
      fontFamily: {
        sans: ['Outfit', 'Roboto', 'ui-sans-serif', 'system-ui'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'glass': 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(11, 11, 12, 0.08)',
        'glass-dark': '0 8px 32px 0 rgba(0, 0, 0, 0.45)',
        'glow-violet': '0 0 20px rgba(127, 108, 228, 0.35)',
        'glow-fuchsia': '0 0 20px rgba(212, 240, 107, 0.45)',
        'card': '0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.04)',
        'card-hover': '0 10px 25px -3px rgba(0,0,0,0.08), 0 4px 6px -4px rgba(0,0,0,0.05)',
      },
      animation: {
        'slide-in': 'slideIn 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        slideIn: {
          '0%': { transform: 'translateX(-100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
