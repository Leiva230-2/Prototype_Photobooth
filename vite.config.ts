import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { boothLink } from './server/booth-link';

// Three pages: the Mac console (index.html), the tablet guest screen
// (guest.html) and the guest gallery (gallery.html).
export default defineConfig({
  plugins: [react(), boothLink()],
  server: {
    // Fixed port: `npm run tablet` forwards the tablet's localhost:5173 to it.
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 5173,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      input: {
        booth: resolve(import.meta.dirname, 'index.html'),
        guest: resolve(import.meta.dirname, 'guest.html'),
        gallery: resolve(import.meta.dirname, 'gallery.html'),
      },
    },
  },
  test: {
    environment: 'node',
  },
});
