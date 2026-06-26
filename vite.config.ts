import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Ensure firebase-applet-config.json always exists to prevent build/import errors
const configPath = path.resolve(__dirname, 'firebase-applet-config.json');
if (!fs.existsSync(configPath)) {
  fs.writeFileSync(
    configPath,
    JSON.stringify(
      {
        apiKey: "mock_api_key_for_local_fallback",
        authDomain: "mock-project.firebaseapp.com",
        projectId: "mock-project",
        storageBucket: "mock-project.appspot.com",
        messagingSenderId: "1234567890",
        appId: "1:1234567890:web:1234567890abcdef",
        firestoreDatabaseId: "(default)"
      },
      null,
      2
    ),
    'utf8'
  );
}

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
        manifest: {
          name: 'Samadhan Setu Civic Engine',
          short_name: 'CivicHero',
          description: 'A platform to report and track municipal civic issues.',
          theme_color: '#4f46e5',
          background_color: '#0f172a',
          display: 'standalone',
          icons: [
            {
              src: 'pwa-icon.svg',
              sizes: '192x192 512x512',
              type: 'image/svg+xml',
              purpose: 'any maskable'
            }
          ]
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
