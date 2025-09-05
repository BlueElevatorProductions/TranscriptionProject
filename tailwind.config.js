/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./src/renderer/**/*.{ts,tsx}",
    "./src/renderer/index.html",
    "./node_modules/@material-tailwind/react/components/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@material-tailwind/react/theme/components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        /* === DESIGN TOKEN MAPPINGS === */
        /* Core color system from design tokens */
        bg: 'hsl(var(--bg))',
        surface: 'hsl(var(--surface))',
        sidebar: 'hsl(var(--sidebar))',
        'sidebar-light': 'hsl(var(--sidebar-light))',
        text: 'hsl(var(--text))',
        'text-muted': 'hsl(var(--text-muted))',
        'text-on-dark': 'hsl(var(--text-on-dark))',
        border: 'hsl(var(--border))',
        'border-muted': 'hsl(var(--border-muted))',
        accent: 'hsl(var(--accent))',
        'accent-hover': 'hsl(var(--accent-hover))',
        warn: 'hsl(var(--warn))',
        success: 'hsl(var(--success))',
        'success-bg': 'hsl(var(--success-bg))',
        'success-text': 'hsl(var(--success-text))',
        error: 'hsl(var(--error))',
        'error-bg': 'hsl(var(--error-bg))',
        'error-text': 'hsl(var(--error-text))',
        'warn-bg': 'hsl(var(--warn-bg))',
        'warn-text': 'hsl(var(--warn-text))',
        'neutral-bg': 'hsl(var(--neutral-bg))',
        'neutral-text': 'hsl(var(--neutral-text))',
        'button-primary': 'hsl(var(--button-primary))',
        'button-primary-hover': 'hsl(var(--button-primary-hover))',
        'button-secondary': 'hsl(var(--button-secondary))',
        'button-secondary-hover': 'hsl(var(--button-secondary-hover))',
        'primary-50': 'hsl(var(--primary-50))',
        
        /* === COMPONENT SPECIFIC COLORS === */
        'sidebar-bg': 'var(--sidebar-bg)',
        'sidebar-text': 'var(--sidebar-text)',
        'transcript-bg': 'var(--transcript-bg)',
        'transcript-text': 'var(--transcript-text)',
        'player-bg': 'var(--player-bg)',
        'player-text': 'var(--player-text)',
        'hover-bg': 'var(--hover-bg)',
        
        /* === VIBRANCY/GLASS EFFECT COLORS === */
        'sidebar-bg-blur': 'var(--sidebar-bg-blur)',
        'panel-bg-blur': 'var(--panel-bg-blur)',
        'glass-surface': 'hsl(var(--glass-surface))',
        'glass-border': 'hsl(var(--glass-border))',
        'glass-hover': 'hsl(var(--glass-hover))',
        'glass-track': 'hsl(var(--glass-track))',
        'glass-border-subtle': 'hsl(var(--glass-border-subtle))',
        
        /* === SHADCN/UI COMPATIBILITY === */
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'calc(var(--radius-xl) + 8px)',
      },
      backdropBlur: {
        'glass': 'var(--backdrop-blur)',
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
        "pulse-highlight": {
          "0%": { 
            backgroundColor: "var(--primary)",
            transform: "scale(1)",
          },
          "50%": { 
            backgroundColor: "var(--primary)",
            transform: "scale(1.02)",
          },
          "100%": { 
            backgroundColor: "var(--primary-50)",
            transform: "scale(1)",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-highlight": "pulse-highlight 0.6s ease-in-out",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        arial: ['var(--font-sidebar)', 'sans-serif'],        // use className="font-arial"
        transcript: ['var(--font-transcript)', 'sans-serif'], // use className="font-transcript"
        mono: ['var(--font-mono)', 'monospace'],             // use className="font-mono"
        sidebar: ['var(--font-sidebar)', 'sans-serif'],      // use className="font-sidebar"
      },
      spacing: {
        'xs': 'var(--spacing-xs)',
        'sm': 'var(--spacing-sm)', 
        'md': 'var(--spacing-md)',
        'lg': 'var(--spacing-lg)',
        'xl': 'var(--spacing-xl)',
        '2xl': 'var(--spacing-2xl)',
      },
      boxShadow: {
        'sm': 'var(--shadow-sm)',
        'md': 'var(--shadow-md)',
        'lg': 'var(--shadow-lg)',
        'xl': 'var(--shadow-xl)',
        'accent': 'var(--shadow-accent)',
        'focus': 'var(--shadow-focus)',
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
}