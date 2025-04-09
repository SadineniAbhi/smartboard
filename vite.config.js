import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: './backend/static/bundles', // just output assets
    emptyOutDir: true,
    rollupOptions: {
      input: './frontend/src/main.ts', // entry point
      output: {
        entryFileNames: 'main.js' 
      }
    }
  }
});
