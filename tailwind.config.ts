import type { Config } from 'tailwindcss'
import animate from 'tailwindcss-animate'

const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
      },
      keyframes: {
        'nudge-ring': {
          '0%': { boxShadow: '0 0 0 0 hsl(var(--primary) / 0.35)' },
          '70%, 100%': { boxShadow: '0 0 0 10px hsl(var(--primary) / 0)' },
        },
        'book-wiggle': {
          '0%, 60%, 100%': { transform: 'rotate(0deg)' },
          '68%': { transform: 'rotate(-12deg)' },
          '76%': { transform: 'rotate(10deg)' },
          '84%': { transform: 'rotate(-6deg)' },
          '92%': { transform: 'rotate(3deg)' },
        },
        'pop-in': {
          '0%': { transform: 'scale(0)' },
          '60%': { transform: 'scale(1.4)' },
          '100%': { transform: 'scale(1)' },
        },
        'cover-flip': {
          '0%': { transform: 'perspective(400px) rotateY(0deg)' },
          '100%': { transform: 'perspective(400px) rotateY(360deg)' },
        },
        flicker: {
          '0%, 100%': { transform: 'scale(1) rotate(-3deg)' },
          '50%': { transform: 'scale(1.12) rotate(3deg)' },
        },
      },
      animation: {
        'nudge-ring': 'nudge-ring 2.4s ease-out infinite',
        'book-wiggle': 'book-wiggle 4s ease-in-out infinite',
        'pop-in': 'pop-in 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'cover-flip': 'cover-flip 0.8s ease-in-out',
        flicker: 'flicker 1.2s ease-in-out infinite',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [animate],
}

export default config
