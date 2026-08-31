import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const instance = process.env.VITE_INSTANCE || "";
const backendTarget = process.env.VITE_BACKEND_URL || "http://localhost:5000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: instance ? 3000 + parseInt(instance) : 3000,
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true,
      },
    },
  },
});
