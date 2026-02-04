import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#FF6B35',
        secondary: '#4ECDC4',
        accent: '#FFE66D',
        dark: '#2C3E50',
        success: '#2ECC71',
        danger: '#E74C3C',
      },
      boxShadow: {
        brutal: '4px 4px 0px 0px rgba(0,0,0,1)',
        'brutal-lg': '6px 6px 0px 0px rgba(0,0,0,1)',
        'brutal-xl': '8px 8px 0px 0px rgba(0,0,0,1)',
      },
      fontFamily: {
        sans: ['system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
