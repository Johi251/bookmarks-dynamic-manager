import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const extRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), 'extension');

/**
 * Build des Browser-Add-ons (Manifest V3) nach dist-ext/.
 * - Vite-Root = extension/ → manager.html + popup.html liegen im Ausgabe-Root.
 * - background.js wird zusätzlich per esbuild als IIFE gebündelt (Skript build:ext),
 *   damit er als Service Worker (Chrome) und background-script (Firefox) läuft.
 * - base './' damit alle Pfade relativ sind (Add-on hat keinen Server-Root).
 */
export default defineConfig({
  base: './',
  root: extRoot,
  publicDir: false,
  plugins: [react()],
  build: {
    outDir: resolve(extRoot, '..', 'dist-ext'),
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2022',
    rollupOptions: {
      input: {
        manager: resolve(extRoot, 'manager.html'),
        popup: resolve(extRoot, 'popup.html'),
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
