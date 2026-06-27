import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { defineConfig } from 'vite';

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
      tailwindcss()
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
