/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        lab: {
          bg: 'rgb(var(--lab-bg) / <alpha-value>)',
          card: 'rgb(var(--lab-card) / <alpha-value>)',
          subtle: 'rgb(var(--lab-subtle) / <alpha-value>)',
          elevated: 'rgb(var(--lab-elevated) / <alpha-value>)',
          border: 'rgb(var(--lab-border) / <alpha-value>)',
          borderHover: 'rgb(var(--lab-border-hover) / <alpha-value>)',
          text: 'rgb(var(--lab-text) / <alpha-value>)',
          muted: 'rgb(var(--lab-muted) / <alpha-value>)',
          dim: 'rgb(var(--lab-dim) / <alpha-value>)',
        },
        barrier: {
          critical: '#DC2626',
          serious: '#EA580C',
          moderate: '#D97706',
          minor: '#0284C7',
          pass: '#16A34A',
        },
        confidence: {
          measured: '#16A34A',
          predicted: '#D97706',
        }
      },
      fontFamily: {
        sans: ['Urbanist', 'system-ui', 'sans-serif'],
        // The UI uses font-mono as a label style (numbers, chips, WCAG codes), so it follows Urbanist too.
        mono: ['Urbanist', 'system-ui', 'sans-serif'],
      },
      // Whole type scale is 1.2x Tailwind's default (smallest text 10px -> 12px).
      // Line heights scale with it so text keeps the same breathing room.
      fontSize: {
        xs: ['0.9rem', { lineHeight: '1.2rem' }],
        sm: ['1.05rem', { lineHeight: '1.5rem' }],
        base: ['1.2rem', { lineHeight: '1.8rem' }],
        lg: ['1.35rem', { lineHeight: '2.1rem' }],
        xl: ['1.5rem', { lineHeight: '2.1rem' }],
        '2xl': ['1.8rem', { lineHeight: '2.4rem' }],
        '3xl': ['2.25rem', { lineHeight: '2.7rem' }],
        '4xl': ['2.7rem', { lineHeight: '3rem' }],
      },
      boxShadow: {
        'glow-cyan': '0 0 24px -4px rgba(56, 189, 248, 0.25)',
        'glow-amber': '0 0 24px -4px rgba(245, 158, 11, 0.25)',
        'glow-ruby': '0 0 24px -4px rgba(239, 68, 68, 0.25)',
        'panel': 'var(--lab-shadow-panel)',
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      }
    },
  },
  plugins: [],
}
