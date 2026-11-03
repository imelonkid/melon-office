import { defineConfig } from 'vite';

const target = `http://127.0.0.1:${process.env.MELON_OFFICE_PORT || 7777}`;

export default defineConfig({
  root: 'web',
  base: './',
  build: { outDir: '../dist', emptyOutDir: true, chunkSizeWarningLimit: 2000 },
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': target,
      '/ws': { target, ws: true },
    },
  },
});
