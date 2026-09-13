/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			colors: {
				border: 'oklch(var(--border))',
				input: 'oklch(var(--input))',
				ring: 'oklch(var(--ring))',
				background: 'oklch(var(--background))',
				foreground: 'oklch(var(--foreground))',
				primary: {
					DEFAULT: 'oklch(var(--primary))',
					foreground: 'oklch(var(--primary-foreground))',
					glow: 'oklch(var(--primary-glow))'
				},
				secondary: {
					DEFAULT: 'oklch(var(--secondary))',
					foreground: 'oklch(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'oklch(var(--destructive))',
					foreground: 'oklch(var(--destructive-foreground))'
				},
				success: {
					DEFAULT: 'oklch(var(--success))',
					foreground: 'oklch(var(--success-foreground))'
				},
				warning: {
					DEFAULT: 'oklch(var(--warning))',
					foreground: 'oklch(var(--warning-foreground))'
				},
				muted: {
					DEFAULT: 'oklch(var(--muted))',
					foreground: 'oklch(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'oklch(var(--accent))',
					foreground: 'oklch(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'oklch(var(--popover))',
					foreground: 'oklch(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'oklch(var(--card))',
					foreground: 'oklch(var(--card-foreground))'
				},
				surface: {
					lowest: 'oklch(var(--surface-lowest))',
					low: 'oklch(var(--surface-low))',
					DEFAULT: 'oklch(var(--surface))',
					high: 'oklch(var(--surface-high))',
					highest: 'oklch(var(--surface-highest))'
				},
				outline: {
					DEFAULT: 'oklch(var(--outline))',
					variant: 'oklch(var(--outline-variant))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				}
			},
			fontFamily: {
				sans: 'var(--font-sans)',
				display: 'var(--font-display)',
				mono: 'var(--font-mono)'
			},
			backgroundImage: {
				'gradient-primary': 'var(--gradient-primary)',
				'gradient-hero': 'var(--gradient-hero)',
				'gradient-card': 'var(--gradient-card)'
			},
			boxShadow: {
				'glow': 'var(--shadow-glow)',
				'card': 'var(--shadow-card)',
				'elevated': 'var(--shadow-elevated)',
				'primary-glow': 'var(--shadow-primary-glow)'
			},
			transitionTimingFunction: {
				'smooth': 'var(--transition-smooth)',
				'bounce': 'var(--transition-bounce)'
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)',
				xl: 'calc(var(--radius) + 4px)',
				'2xl': 'calc(var(--radius) + 8px)'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				},
				'fade-in': {
					'0%': {
						opacity: '0',
						transform: 'translateY(20px)'
					},
					'100%': {
						opacity: '1',
						transform: 'translateY(0)'
					}
				},
				'slide-up': {
					'0%': {
						opacity: '0',
						transform: 'translateY(100px)'
					},
					'100%': {
						opacity: '1',
						transform: 'translateY(0)'
					}
				},
				'glow-pulse': {
					'0%, 100%': {
						boxShadow: '0 0 20px hsl(var(--primary) / 0.3)'
					},
					'50%': {
						boxShadow: '0 0 40px hsl(var(--primary) / 0.6)'
					}
				},
				'scale-in': {
					'0%': {
						opacity: '0',
						transform: 'scale(0.95)'
					},
					'100%': {
						opacity: '1',
						transform: 'scale(1)'
					}
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'fade-in': 'fade-in 0.6s ease-out',
				'slide-up': 'slide-up 0.8s ease-out',
				'glow-pulse': 'glow-pulse 3s ease-in-out infinite',
				'scale-in': 'scale-in 0.5s ease-out'
			}
		}
	},
	plugins: [require("tailwindcss-animate"), require('daisyui')],
   daisyui: {
    themes: false,
   }
}