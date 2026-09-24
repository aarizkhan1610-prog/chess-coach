import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5188, strictPort: true },
  // The engine files in public/engine are pre-built WASM artifacts; never transform them.
  assetsInclude: ['**/*.wasm'],
});
