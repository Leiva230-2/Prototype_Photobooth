import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

// Two pages: the booth app (index.html) and the guest gallery (gallery.html).
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        booth: resolve(import.meta.dirname, 'index.html'),
        gallery: resolve(import.meta.dirname, 'gallery.html'),
      },
    },
  },
  test: {
    environment: 'node',
  },
});
