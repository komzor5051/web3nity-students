/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#F2EDE3',
        surface: '#FFFDF8',
        'surface-hover': '#EAE3D7',
        line: '#CDC4B6',
        'line-light': '#E3DCCF',
        ink: '#191814',
        text2: '#686157',
        text3: '#92897B',
        accent: '#F15A38',
        'accent-light': '#FFE2D8',
        'accent-dark': '#C83B1F',
        'tag-bg': '#E7E0D4',
        'tag-text': '#4A443A',
        green: '#2D8F5E',
        purple: '#7C3AED',
        blue: '#2A6BE8',
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
        display: ['Unbounded', 'Manrope', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        sm: '6px',
        DEFAULT: '14px',
        lg: '24px',
        full: '9999px',
      },
    },
  },
  plugins: [],
};
