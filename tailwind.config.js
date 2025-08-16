/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./src/renderer/**/*.{ts,tsx}",
    "./src/renderer/index.html"
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
        /* Region-scoped colors from new UI design */
        'sidebar-bg': 'var(--sidebar-bg)',
        'sidebar-text': 'var(--sidebar-text)',
        'transcript-bg': 'var(--transcript-bg)',
        'transcript-text': 'var(--transcript-text)',
        'player-bg': 'var(--player-bg)',
        'player-text': 'var(--player-text)',
        'hover-bg': 'var(--hover-bg)',
        
        /* General tokens for broader use */
        bg: 'hsl(var(--bg))',
        surface: 'hsl(var(--surface))',
        sidebar: 'hsl(var(--sidebar))',
        text: 'hsl(var(--text))',
        'text-muted': 'hsl(var(--text-muted))',
        warn: 'hsl(var(--warn))',
        
        /* Existing colors kept for compatibility */
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
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
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        '2xl': 'calc(var(--radius-lg) + 8px)',
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
        transcript: ['var(--font-transcript)', 'sans-serif'] // use className="font-transcript"
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
}