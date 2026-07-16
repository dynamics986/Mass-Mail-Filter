import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "CU Link — CUHK Mass Mail Filter",
        short_name: "CU Link",
        description: "A private, explainable opportunity filter for CUHK Mass Mail.",
        theme_color: "#0b4f45",
        background_color: "#f7f4eb",
        display: "standalone",
        start_url: "./",
        icons: [{ src: "favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }]
      },
      workbox: {
        navigateFallback: "index.html",
        runtimeCaching: [{
          urlPattern: /\/data\/(feed|meta)\.json$/,
          handler: "NetworkFirst",
          options: { cacheName: "cuhk-feed", networkTimeoutSeconds: 5, expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 30 } }
        }]
      }
    })
  ],
  test: { environment: "jsdom", setupFiles: "./src/test/setup.ts", include: ["src/**/*.test.{ts,tsx}"] }
});
