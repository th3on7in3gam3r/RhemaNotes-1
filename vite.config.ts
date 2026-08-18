import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/v1beta': {
            target: 'https://generativelanguage.googleapis.com',
            changeOrigin: true,
            configure: (proxy, options) => {
              proxy.on('proxyReq', (proxyReq, req, res) => {
                proxyReq.setHeader('x-goog-api-key', env.GEMINI_API_KEY || '');
              });
            }
          },
          '/api': {
            target: 'http://localhost:8888',
            changeOrigin: true,
            secure: false,
          }
        }
      },
      plugins: [
        react(),
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
          workbox: {
            // Do not precache index.html — stale shell → 404 on old hashed JS → blank page.
            globPatterns: ['**/*.{js,css,ico,png,svg,woff2,webmanifest}'],
            // Worker serves all routes; SW must not intercept navigations with cached HTML.
            navigateFallback: null,
            navigateFallbackDenylist: [/^\/api\//],
            skipWaiting: true,
            clientsClaim: true,
            runtimeCaching: [
              {
                urlPattern: ({ request }) => request.mode === 'navigate',
                handler: 'NetworkFirst',
                options: {
                  cacheName: 'html-nav-v1',
                  expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 },
                  networkTimeoutSeconds: 5,
                },
              },
              {
                urlPattern: /\.(?:js|css|png|jpg|jpeg|svg|ico|woff2?)$/,
                handler: 'StaleWhileRevalidate',
                options: { cacheName: 'static-assets-v3' },
              },
            ],
          },
          manifest: {
            name: 'RhemaNotes',
            short_name: 'RhemaNotes',
            description: 'AI-powered instant sermon summaries and study tools',
            theme_color: '#ffffff',
            background_color: '#ffffff',
            display: 'standalone',
            icons: [
              {
                src: 'favicon.ico',
                sizes: '64x64 32x32 24x24 16x16',
                type: 'image/x-icon'
              }
            ]
          }
        })
      ],
      define: {
        // Removed GEMINI_API_KEY from client bundle for security
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
