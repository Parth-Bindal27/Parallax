/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}'
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        workspace: {
          950: '#060A12',
          900: '#0A101D',
          850: '#0F172A',
          800: '#152138',
          750: '#1C2B47',
          700: '#263758',
          600: '#384B70'
        },
        brand: {
          cyan: '#06B6D4',
          cyanGlow: '#38BDF8',
          indigo: '#6366F1',
          indigoDark: '#4F46E5'
        },
        status: {
          pass: '#10B981',
          fail: '#EF4444',
          stale: '#F59E0B',
          uncertain: '#8B5CF6',
          unprovable: '#64748B'
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Menlo', 'monospace']
      }
    }
  },
  plugins: []
};
