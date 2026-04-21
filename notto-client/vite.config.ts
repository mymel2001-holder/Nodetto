import { defineConfig } from "vite";
import tailwindcss from '@tailwindcss/vite'
import react from "@vitejs/plugin-react";
import type { UserConfig } from "vitest/config";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

const testConfig: UserConfig["test"] = {
  globals: true,
  environment: "jsdom",
  setupFiles: ["./src/test/setup.ts"],
  coverage: {
    provider: "v8",
    include: ["src/**/*.{ts,tsx}"],
    exclude: ["src/main.tsx", "src/test/**"],
  },
};

import { VitePWA } from 'vite-plugin-pwa'
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  test: testConfig,
  plugins: [
    react(), 
    tailwindcss(),
    wasm(),
    topLevelAwait(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'Notto',
        short_name: 'Notto',
        description: 'End-to-end encrypted note-taking app',
        theme_color: '#1e293b',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],

  server: {
    port: 1420,
    strictPort: true,
  },
  optimizeDeps: {
    exclude: []
  },
  build: {
    target: 'esnext'
  }
}));
