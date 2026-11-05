import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@dsp': resolve(__dirname, 'src/dsp'),
    },
  },
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2022',
  },
});
