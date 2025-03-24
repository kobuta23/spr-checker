import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001, // To avoid conflicts with the backend on port 3000
    proxy: {
      '/eligibility': {
        target: 'http://main.superfluid.dev:9900',
        changeOrigin: true,
      }
    }
  }
}); 