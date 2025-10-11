import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './src/manifest.json';

export default defineConfig({
  plugins: [
    crx({ manifest })
  ],
  build: {
    rollupOptions: {
      input: {
        popup: 'src/popup.html',
        fullscreen: 'src/fullscreen.html',
        sidebar: 'src/sidebar.js',
        contentCss: 'src/content.css'
      }
    }
  }
});