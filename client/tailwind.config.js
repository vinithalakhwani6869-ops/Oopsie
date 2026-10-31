/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#F6F1E7',
        paper: '#FFFDF8',
        ink: {
          DEFAULT: '#1E1B18',
          soft: '#514B44',
          mute: '#7C7468',
        },
        coral: {
          50: '#FFF2ED',
          100: '#FFE2D7',
          200: '#FFC5B1',
          300: '#FF9C7C',
          400: '#FA7450',
          500: '#EE552D',
          600: '#D23F1C',
          700: '#A93217',
        },
        mint: {
          50: '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          500: '#10B981',
          600: '#059669',
          700: '#047857',
        },
        sun: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          500: '#F59E0B',
          700: '#B45309',
        },
        sky: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          600: '#2563EB',
          700: '#1D4ED8',
        },
      },
      fontFamily: {
        sans: ['"DM Sans"', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['"Fraunces"', 'Georgia', 'Cambria', 'serif'],
      },
      boxShadow: {
        card: '0 1px 0 rgba(30,27,24,0.03), 0 18px 40px -28px rgba(30,27,24,0.45)',
        lift: '0 2px 0 rgba(30,27,24,0.05), 0 22px 50px -26px rgba(30,27,24,0.5)',
        hard: '3px 3px 0 0 rgba(30,27,24,1)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.35s ease-out both',
        'pop-in': 'pop-in 0.25s ease-out both',
        'pulse-soft': 'pulse-soft 1.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
