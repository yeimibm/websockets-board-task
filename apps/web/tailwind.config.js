import sharedPreset from '@collab/config/tailwind/preset';

/** @type {import('tailwindcss').Config} */
export default {
  presets: [sharedPreset],
  content: ['./index.html', './src/client/**/*.{ts,html}'],
  theme: {
    extend: {
      colors: {
        ink: '#243047',
        canvas: '#f6f7fb',
        brand: { 50: '#f0f4ff', 500: '#6475e6', 600: '#5564d7' },
      },
      boxShadow: { soft: '0 18px 45px rgba(36, 48, 71, 0.10)' },
    },
  },
  plugins: [],
};
