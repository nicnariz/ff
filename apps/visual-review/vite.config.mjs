import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.VISUAL_REVIEW_BASE_PATH ?? '/',
  publicDir: 'static',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
