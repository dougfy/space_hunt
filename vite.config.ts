import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { devvit } from '@devvit/start/vite';
import { readFileSync } from 'fs';

const { version } = JSON.parse(readFileSync('./version.json', 'utf-8'));

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  test: {
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['tests/**', 'dist/**', 'node_modules/**'],
  },
  plugins: [react(), tailwind(), devvit()],
});
