import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './map/**/*.{js,ts,jsx,tsx}',
    './hooks/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        display: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        'ocean-dark': '#0A2540',
        'mangrove': '#0F3D2E',
        'estuary': '#1F7A63',
        'sat-cyan': '#19D3DA',
        'storm-orange': '#F28C38',
        'tidal-sand': '#D8C9A7',
        'wetland-mist': '#F2F6F5',
        'danger': '#E63946',
      },
      borderRadius: {
        'sm': '8px',
        'md': '12px',
        'lg': '20px',
      },
    },
  },
  plugins: [],
};

export default config;
