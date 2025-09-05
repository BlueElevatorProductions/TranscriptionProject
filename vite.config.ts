import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath, URL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  root: 'src/renderer',
  base: './',
  build: {
    outDir: '../../build/renderer',
    emptyOutDir: true,
    minify: 'esbuild',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'src/renderer/index.html')
      }
    }
  },
  mode: 'production',
  server: {
    port: 5174, // Changed to avoid conflicts
    strictPort: false,
    open: false,
    host: 'localhost',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    }
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  optimizeDeps: {
    exclude: ['electron']
  },
});