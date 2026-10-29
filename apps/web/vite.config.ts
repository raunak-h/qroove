/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { BRAND } from '../../packages/config/src/brand';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'qroove-site-url',
      transformIndexHtml: (html: string) => html.replaceAll('%SITE_URL%', BRAND.siteUrl),
    },
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-32.png', 'icons/apple-touch-icon.png', 'icons/og-image.png'],
      manifest: {
        name: 'Qroove',
        short_name: 'Qroove',
        description: 'Fair, collaborative music queues for dance socials.',
        theme_color: '#1c1b1f',
        background_color: '#1c1b1f',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: { navigateFallbackDenylist: [/^\/api\//, /^\/docs(\/|$)/] },
    }),
  ],
  server: { proxy: { '/api': 'http://localhost:3000' } },
  test: { environment: 'jsdom', setupFiles: ['./vitest.setup.ts'] },
});
