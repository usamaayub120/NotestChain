import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["fonts/*.woff2"],
      manifest: {
        name: "NotesChain",
        short_name: "NotesChain",
        description: "A public writing platform for publishing permanent, verifiable thoughts.",
        theme_color: "#F6F1E8",
        background_color: "#F6F1E8",
        display: "standalone",
        start_url: "/",
        // TODO(Phase 6): add real 192/512/maskable PNG icons generated from
        // the Kept Stamp mark (public/favicon.svg is a placeholder for now).
        icons: [{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml" }],
      },
      workbox: {
        // Never cache anything under /api/v1/auth, /api/v1/drafts, /api/v1/bookmarks,
        // /api/v1/admin, or /api/v1/moderation — those carry session-scoped data.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /\/api\/v1\/(publications|search|profiles|tags)(\/.*)?$/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "public-api-cache",
              expiration: { maxEntries: 200, maxAgeSeconds: 300 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
