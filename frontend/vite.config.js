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
        entryFileNames: "main-add-nozbart-20260711.js",
        chunkFileNames: "chunks/[name]-add-nozbart-20260711.js",
        assetFileNames: "main-add-nozbart-20260711[extname]",
      },
    },
  },
});
