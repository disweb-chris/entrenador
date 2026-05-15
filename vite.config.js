import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/entrenador/",
  build: {
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name]-[hash]-v3.js`,
        chunkFileNames: `assets/[name]-[hash]-v3.js`,
        manualChunks: {
          "firebase": ["firebase/app", "firebase/auth", "firebase/firestore"],
          "react-vendor": ["react", "react-dom"],
        },
      },
    },
  },
});