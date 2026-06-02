import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: '$harky — Finanzas personales',
        short_name: '$harky',
        description: 'Registra ingresos, gastos, presupuestos y metas de ahorro.',
        theme_color: '#3b82f6',
        background_color: '#0a0e16',
        display: 'standalone',
        start_url: '/',
        orientation: 'any',
        categories: ['finance', 'productivity'],
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // cachear todos los assets estáticos
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // no cachear los chunks de exportación grandes (se cargan on-demand)
        globIgnores: ['**/jspdf*', '**/html2canvas*', '**/imageExport*'],
        runtimeCaching: [
          {
            // fonts de Google
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 3000 },
})
