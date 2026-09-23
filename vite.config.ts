import { defineConfig } from 'vite';

export default defineConfig({
  // Pages supplies its project/custom-domain path; local development stays at /.
  base: process.env.BEE_BASE_PATH || '/',
  server: {
    host: '127.0.0.1',
    port: 5188,
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 4188,
    strictPort: true,
  },
  build: {
    sourcemap: true,
    chunkSizeWarningLimit: 900,
  },
});
