/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // v3 light palette
        bg: '#FAFAF8',
        surface: '#FFFFFF',
        'surface-hover': '#F5F3EF',
        line: '#E8E4DD',
        'line-light': '#F0EDE8',
        ink: '#1A1A18',
        text2: '#6B6860',
        text3: '#9B978E',
        accent: '#E85A2A',
        'accent-light': '#FFF0EB',
        'accent-dark': '#C94820',
        'tag-bg': '#F3F1EC',
        'tag-text': '#4A4740',
        green: '#2D8F5E',
        'green-bg': '#EEFBF3',
        blue: '#2A6BE8',
        'blue-bg': '#EBF1FF',
        purple: '#7C3AED',
        'purple-bg': '#F3EEFF',
        yellow: '#CA8A04',
        'yellow-bg': '#FEFCE8',
        // Совместимость со старыми классами — на случай, если в legacy-страницах
        // (`/students/[slug]`) остались отсылки. Мапим в ту же палитру.
        cream: '#1A1A18',
        muted: '#6B6860',
      },
      fontFamily: {
        sans: ['DM Sans', 'Manrope', 'Inter', 'system-ui', 'sans-serif'],
        display: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      borderRadius: {
        sm: '8px',
        DEFAULT: '12px',
        lg: '16px',
        full: '9999px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(0,0,0,.04)',
        md: '0 4px 16px rgba(0,0,0,.06)',
        lg: '0 8px 32px rgba(0,0,0,.08)',
      },
    },
  },
  plugins: [],
};
