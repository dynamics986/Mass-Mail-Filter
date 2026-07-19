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
        name: "CU Link — CUHK Opportunity Filter",
        short_name: "CU Link",
        description: "CUHK digest filter: ranked opportunities, timeline, optional on-device AI polish.",
        theme_color: "#5B2C6F",
        background_color: "#F7F2FA",
        display: "standalone",
        start_url: "./",
        icons: [{ src: "favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
      },
      workbox: {
        navigateFallback: "index.html",
        runtimeCaching: [
          {
            urlPattern: /\/data\/(feed|meta|faculties)\.json$/,
            handler: "NetworkFirst",
            options: {
              cacheName: "cu-link-data",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
  optimizeDeps: {
    exclude: ["@xenova/transformers"],
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
