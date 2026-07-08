import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/static/react/home/",
  build: {
    outDir: "../static/react/home",
    emptyOutDir: true,
    rollupOptions: {
      input: "src/main.jsx",
      output: {
        entryFileNames: "main-testimonials-touch-20260708.js",
        chunkFileNames: "chunks/[name]-testimonials-touch-20260708.js",
        assetFileNames: "main-testimonials-touch-20260708[extname]",
      },
    },
  },
});
