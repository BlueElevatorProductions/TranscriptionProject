import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath, URL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Allow Vite to choose dev/prod transforms automatically based on command.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  root: 'src/renderer',
  base: './',
  build: {
    outDir: '../../build/renderer',
    emptyOutDir: true,
    minify: 'esbuild',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'src/renderer/index.html'),
      },
    },
  },
  // Use a consistent dev port that matches main.ts when USE_LOCALHOST=true
  server: {
    port: 3000,
    strictPort: false,
    open: false,
    host: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  // Do not force NODE_ENV here; let Vite/plugin-react pick the right JSX runtime
  optimizeDeps: {
    exclude: ['electron'],
  },
}));
