import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env from root directory
  const env = loadEnv(mode, path.resolve(__dirname, '..'), '')

  return {
  plugins: [react()],
  envDir: '..',  // Load .env from parent directory
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        followRedirects: true,
      },
      '/raleigh': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/raleigh/, ''),
      },
      '/durham': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/durham/, ''),
      },
      '/elastic-proxy': {
        target: env.VITE_KIBANA_ENDPOINT || 'https://my-elasticsearch-project-e85ed9.kb.us-east-1.aws.elastic.cloud',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/elastic-proxy/, ''),
        secure: true,
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // Add API key to proxied requests from root .env
            proxyReq.setHeader('Authorization', `ApiKey ${env.VITE_ELASTIC_API_KEY}`);
            proxyReq.setHeader('kbn-xsrf', 'true');
          });
        }
      }
    }
  }
  }
})
