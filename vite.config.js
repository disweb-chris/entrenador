import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // El service worker se actualiza solo: sin esto habría que enseñarle al
      // usuario a forzar recarga, que es justo lo que veníamos parcheando a
      // mano con el sufijo -v4 en los nombres de archivo.
      registerType: "autoUpdate",
      includeAssets: ["apple-touch-icon.png"],
      manifest: {
        name: "OVERLOAD",
        short_name: "OVERLOAD",
        description: "Tracker de entrenamiento orientado a la sobrecarga progresiva",
        lang: "es",
        start_url: "/entrenador/",
        scope: "/entrenador/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#0a0a0a",
        theme_color: "#0a0a0a",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Precachea el shell para que la app abra sin señal. Los datos ya los
        // resuelve el cache offline de Firestore (ver lib/firebase.js).
        globPatterns: ["**/*.{js,css,html,png,woff2}"],
        navigateFallback: "index.html",
        // Las fuentes vienen de Google Fonts: se cachean al primer uso para que
        // la tipografía no desaparezca sin conexión.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "google-fonts-stylesheets" },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-files",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        // Firestore maneja su propia persistencia; que el SW se meta en el
        // medio rompería la cola de escrituras offline.
        navigateFallbackDenylist: [/^\/__/, /firestore\.googleapis\.com/],
      },
    }),
  ],
  base: "/entrenador/",
  build: {
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name]-[hash]-v4.js`,
        chunkFileNames: `assets/[name]-[hash]-v4.js`,
      },
    },
  },
});
