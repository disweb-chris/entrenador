import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/entrenador/",
  optimizeDeps: {
    include: ["firebase/app", "firebase/auth", "firebase/firestore"],
  },
  build: {
    commonjsOptions: {
      include: [/firebase/, /node_modules/],
    },
  },
});
