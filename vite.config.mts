import federation from "@originjs/vite-plugin-federation";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

import { scopeTailwindOutput } from "./scripts/postcss-scope-plugin";

export default defineConfig(({ command }) => ({
  // No `base`. A relative base ("./") makes the federation plugin emit chunk
  // ids as "./assets/<chunk>", which the browser resolves against the URL of
  // remoteEntry.js — itself already in /assets/ — giving /assets/assets/<chunk>
  // and a 404. The default base emits "./<chunk>", which resolves correctly.
  envPrefix: "REACT_",
  plugins: [
    federation({
      name: "care_vision_prescription_fe",
      filename: "remoteEntry.js",
      exposes: {
        "./manifest": "./src/manifest.tsx",
      },
      shared: [
        "react",
        "react-dom",
        "react-dom/client",
        "react-i18next",
        "i18next",
        "@tanstack/react-query",
      ],
    }),
    tailwindcss(),
    react(),
    ...(command === "build" ? [scopeTailwindOutput()] : []),
  ],
  build: {
    target: "es2022",
    minify: false,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: {
      output: {
        format: "esm",
      },
      input: {
        main: "./src/index.tsx",
      },
    },
  },
  preview: {
    port: 4178,
    strictPort: true,
    allowedHosts: true,
    host: "0.0.0.0",
    cors: { origin: "*" },
  },
  server: {
    host: "0.0.0.0",
    port: 4178,
    strictPort: true,
    cors: { origin: "*" },
  },
  resolve: {
    alias: {
      "use-sync-external-store/shim/with-selector.js": path.resolve(
        __dirname,
        "./src/shims/with-selector.ts",
      ),
      "use-sync-external-store/shim/with-selector": path.resolve(
        __dirname,
        "./src/shims/with-selector.ts",
      ),
      "use-sync-external-store/with-selector.js": path.resolve(
        __dirname,
        "./src/shims/with-selector.ts",
      ),
      "use-sync-external-store/with-selector": path.resolve(
        __dirname,
        "./src/shims/with-selector.ts",
      ),
      "use-sync-external-store/shim/index.js": path.resolve(
        __dirname,
        "./src/shims/shim.ts",
      ),
      "use-sync-external-store/shim": path.resolve(
        __dirname,
        "./src/shims/shim.ts",
      ),
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
