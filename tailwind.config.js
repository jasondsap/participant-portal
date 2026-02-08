/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Neutral Portal Color Palette
        portal: {
          primary: '#5B7C99',      // Slate Blue - main actions
          secondary: '#4A9B9B',    // Warm Teal - accents
          background: '#F7F8FA',   // Soft Gray - page bg
          surface: '#FFFFFF',      // White - cards
          text: '#374151',         // Charcoal - body text
          muted: '#6B7280',        // Gray - secondary text
          border: '#E5E7EB',       // Light gray - borders
          success: '#10B981',      // Green - positive states
          warning: '#F59E0B',      // Amber - warnings
          error: '#EF4444',        // Red - errors
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
