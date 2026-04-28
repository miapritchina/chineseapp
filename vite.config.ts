import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves this repo at https://decobots.github.io/Ai-/, not at the
// root, so all built asset URLs need the /Ai-/ prefix. Override with VITE_BASE
// when serving from a different path (e.g. a custom domain at root).
const BASE = process.env.VITE_BASE ?? '/Ai-/';

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
