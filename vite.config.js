import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'offline.html', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'Рыбалка в Прикамье',
        short_name: 'Рыбалка',
        description:
          'Базы, отчёты, карта и лунный календарь рыболова Пермского края. Работает офлайн после первого визита; экстренный вызов 112.',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        lang: 'ru',
        categories: ['travel', 'sports', 'lifestyle'],
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/uploads/],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // Don't leave stale HTML/shell in runtime cache
        runtimeCaching: [
          {
            // Mutations never from cache
            urlPattern: ({ url, request }) =>
              url.pathname.startsWith('/api/') && request.method !== 'GET',
            handler: 'NetworkOnly',
          },
          {
            // Public GET API: show last good response on slow / offline nets
            urlPattern: ({ url, request }) => {
              if (request.method !== 'GET' || !url.pathname.startsWith('/api/')) return false;
              const p = url.pathname;
              if (
                p.includes('/admin') ||
                p.includes('/mine') ||
                p.includes('/moderation') ||
                p.includes('/wallet') ||
                p.includes('/auth')
              ) {
                return false;
              }
              return true;
            },
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-read-cache-v1',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url, request }) =>
              request.method === 'GET' && url.pathname.startsWith('/uploads/'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'uploads-cache-v1',
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 14 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // OSM tiles for offline map (after first online visit)
            urlPattern: ({ url }) =>
              url.hostname.endsWith('tile.openstreetmap.org') ||
              url.hostname.endsWith('openstreetmap.org'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles-v1',
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Always prefer network for SPA shell so deploys show up
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages-cache-v3',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 16, maxAgeSeconds: 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'images-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/icons/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'icon-cache',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          // Hashed JS/CSS are precached — do not SWR-cache them under a shared name
          // (that kept old bundles alive after deploy)
        ],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      // SW in dev caches CSS/JS and hides HMR header fixes — enable only for PWA testing
      devOptions: {
        enabled: false,
      },
    }),
  ],
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('react-dom') || id.includes('/react/') || id.includes('\\react\\')) {
            return 'vendor-react';
          }
          if (id.includes('react-router')) return 'vendor-router';
          if (id.includes('leaflet')) return 'vendor-leaflet';
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
      '/uploads': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
});
