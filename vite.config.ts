import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["mailroute-icon-32.png", "mailroute-apple-touch-icon.png"],
      manifest: {
        name: "CUHK MailRoute — CUHK Opportunity Filter",
        short_name: "MailRoute",
        description: "CUHK digest filter: ranked opportunities, timeline, optional on-device AI polish.",
        theme_color: "#5B2C6F",
        background_color: "#F7F2FA",
        display: "standalone",
        start_url: "./",
        icons: [
          { src: "mailroute-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "mailroute-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        ],
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
