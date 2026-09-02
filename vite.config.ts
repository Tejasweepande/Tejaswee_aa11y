import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/a11y-lab/' : '/',
  server: {
    port: 3000,
    open: false,
  },
}));
