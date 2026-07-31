/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#FAFAF8',
        surface: '#FFFFFF',
        'surface-hover': '#F5F3EF',
        line: '#E8E4DD',
        'line-light': '#F0EDE8',
        ink: '#1A1A18',
        text2: '#6B6860',
        text3: '#9B978E',
        accent: '#1F3A5F',
        'accent-light': '#EDF1F7',
        'accent-dark': '#152841',
        'tag-bg': '#F3F1EC',
        'tag-text': '#4A4740',
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        sm: '8px',
        DEFAULT: '12px',
        lg: '16px',
        full: '9999px',
      },
    },
  },
  plugins: [],
};
