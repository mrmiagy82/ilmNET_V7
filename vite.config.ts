import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Fase 5.5: `vite-plugin-singlefile` forces `base: "./"` so the built file can be moved around;
    // its documented `overrideConfig` puts the base back to "/" — which is what a SPA served from
    // the site root needs. With a relative base, `url(./fonts/…)` in the inlined CSS and
    // `href="./favicon.svg"` in the head are resolved against the *current route*: on
    // /lectures/<slug> the browser asked for /lectures/fonts/… and /lectures/favicon.svg and got a
    // 404 (measured: 4 failed font requests on a detail page). Everything ilmNet ships lives at the
    // root, so root-absolute URLs are always right.
    viteSingleFile({ overrideConfig: { base: '/' } }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
      "/uploads": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
