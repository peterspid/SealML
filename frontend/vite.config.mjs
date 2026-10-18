import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));



export default defineConfig({
  root: ".",
  define: { global: "globalThis" },
  resolve: {
    alias: {
      process: "process/browser",
      buffer: "buffer",
      util: "util",
      crypto: "crypto-browserify",
      stream: "stream-browserify",
      events: "events",
    },
  },
  plugins: [wasm()],
  build: {
    target: "esnext",
    outDir: "frontend/dist",
    emptyOutDir: false,
    lib: {
      entry: "frontend/wallet-deployer.js",
      formats: ["es"],
      fileName: () => "wallet-deployer.js",
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        assetFileNames: "wallet-assets/[name][extname]",
      },
    },
  },
  assetsInclude: ["**/*.wasm"],
});
