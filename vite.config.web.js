import { defineConfig } from 'vite';
import { resolve } from 'path';

// Vite configuration for web application build
export default defineConfig({
  root: './',
  publicDir: false, // Disable public directory to avoid conflicts
  build: {
    outDir: 'public',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      }
    }
  },
  server: {
    port: 3000,
    open: true
  },
  base: './' // Use relative paths for GitLab Pages
});