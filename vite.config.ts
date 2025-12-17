import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto', // Auto-injects the SW script. Do NOT touch main.tsx
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Cổng Cư Dân Q-Home',
        short_name: 'Q-Home',
        description: 'Cổng thông tin cư dân và thanh toán trực tuyến',
        theme_color: '#006d4e', // Matching the app header color
        background_color: '#ffffff',
        display: 'standalone', // Makes it look like a native app
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'], // Cache basic assets
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
      }
    }),
  ],
});
