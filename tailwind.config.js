/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    // The whole tool uses exactly five text sizes. Replacing (not extending)
    // Tailwind's defaults means no other size can be used by accident.
    // One exception: src/components/FindingCard.tsx keeps its Figma sizes (custom px classes).
    fontSize: {
      xs: ['12px', { lineHeight: '16px' }],
      sm: ['14px', { lineHeight: '20px' }],
      base: ['16px', { lineHeight: '24px' }],
      lg: ['20px', { lineHeight: '28px' }],
      xl: ['24px', { lineHeight: '32px' }],
    },
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
          accent: 'rgb(var(--lab-accent) / <alpha-value>)',
          accentHover: 'rgb(var(--lab-accent-hover) / <alpha-value>)',
          onAccent: 'rgb(var(--lab-on-accent) / <alpha-value>)',
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
      // One corner radius for every rectangular element (buttons, fields, chips, cards,
      // panels, dialogs). Change it here to change it everywhere. Pins and dots stay round (rounded-full).
      borderRadius: {
        DEFAULT: '4px',
      },
      boxShadow: {
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
