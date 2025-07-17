import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: "/BidWhist/", // ← 🔥 This is the key fix for GitHub Pages
  server: {
    host: "::",
    port: 8080,
  },

  build: {
    outDir: "docs",
  },
  plugins: [
    react()
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
