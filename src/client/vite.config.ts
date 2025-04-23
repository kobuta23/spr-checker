import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
const environment = process.env.NODE_ENV

console.log("Environment:", environment);
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react() as any],
  server: {
    port: 3001, // To avoid conflicts with the backend on port 3000
    proxy: {
      '/api': {
        target: environment === 'development' ? 'http://localhost:9900' : 'https://superfluid-referral-api.s.superfluid.dev',
        changeOrigin: true
      },
      '/eligibility': {
        target: environment === 'development' ? 'http://localhost:9900' : 'https://superfluid-eligibility-api.s.superfluid.dev',
        changeOrigin: true,
      },
      '/stack-activity': {
        target: environment === 'development' ? 'http://localhost:9900' : 'https://superfluid-eligibility-api.s.superfluid.dev',
        changeOrigin: true,
      },
      '/superfluid': {
        target: environment === 'development' ? 'http://localhost:9900' : 'https://superfluid-eligibility-api.s.superfluid.dev',
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: 'build',
    assetsDir: 'static',
    sourcemap: true,
    emptyOutDir: true,
  }
}); 