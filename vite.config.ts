import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves this repo at https://decobots.github.io/chineseapp/, not
// at the root, so all built asset URLs need the /chineseapp/ prefix. Override
// with VITE_BASE when serving from a different path (e.g. a custom domain at
// root, or the legacy /Ai-/ path before the repo rename).
const BASE = process.env.VITE_BASE ?? '/chineseapp/';

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: '中文 · Chinese',
        short_name: '中文',
        description: 'Chinese character learning: search, save, decompose, review.',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        background_color: '#faf8f4',
        theme_color: '#faf8f4',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        clientsClaim: true,
        skipWaiting: true,
        // Precache the app shell only. The two dictionary JSONs are ~3 MB
        // and change on data refreshes — runtime-cached below instead.
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        globIgnores: ['**/data-chars.json', '**/phonetic-components.json'],
        // /storybook/ is real files copied into the site AFTER the Vite
        // build — a SPA navigate-fallback to index.html would shadow it.
        // (The network/ + components/ graph pages retired in v109 —
        // replaced by the in-app Explore page.)
        navigateFallbackDenylist: [/\/storybook\//],
        runtimeCaching: [
          {
            // Dictionary + phonetics data: serve cached, refresh behind.
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.endsWith('.json'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'app-data',
              expiration: { maxEntries: 10 },
            },
          },
          {
            // hanzi-writer bundle and per-character stroke data from
            // jsdelivr.
            urlPattern: ({ url }) => url.hostname === 'cdn.jsdelivr.net',
            handler: 'CacheFirst',
            options: {
              cacheName: 'cdn',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Per-word TTS MP3s (v106) — each word is fetched once,
            // then plays instantly and offline. Opaque responses
            // (status 0) are expected: the audio element fetches
            // cross-origin without CORS.
            urlPattern: ({ url }) => url.hostname === 'dict.youdao.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'tts-audio',
              expiration: { maxEntries: 1000, maxAgeSeconds: 60 * 60 * 24 * 180 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
