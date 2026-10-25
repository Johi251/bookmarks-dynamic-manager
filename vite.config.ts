import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base muss zum GitHub-Pages-Unterpfad passen (LIVE-DEPLOYMENT)
export default defineConfig({
  base: '/bookmarks-dynamic-manager/',
  plugins: [react()],
  build: {
    sourcemap: false,
    target: 'es2022',
  },
});
