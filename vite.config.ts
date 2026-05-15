import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves this repo at https://decobots.github.io/chineseapp/, not
// at the root, so all built asset URLs need the /chineseapp/ prefix. Override
// with VITE_BASE when serving from a different path (e.g. a custom domain at
// root, or the legacy /Ai-/ path before the repo rename).
const BASE = process.env.VITE_BASE ?? '/chineseapp/';

export default defineConfig({
  base: BASE,
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
