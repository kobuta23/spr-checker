import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
const environment = "dev"
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001, // To avoid conflicts with the backend on port 3000
    proxy: {
      '/eligibility': {
        target: environment === 'dev' ? 'http://localhost:9900' : 'https://superfluid-eligibility-api.s.superfluid.dev',
        changeOrigin: true,
      },
      '/stack-activity': {
        target: environment === 'dev' ? 'http://localhost:9900' : 'https://superfluid-stack-activity-api.s.superfluid.dev',
        changeOrigin: true,
      }
    }
  }
}); 