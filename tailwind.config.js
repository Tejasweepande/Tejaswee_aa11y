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
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['Fira Code', 'monospace'],
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
