import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const FRONTEND_PORT = 5175;
const API_PROXY_TARGET = 'http://127.0.0.1:5001';

function apiProxyDiagnostics() {
  return {
    name: 'the-system-api-proxy-diagnostics',
    configureServer(server) {
      server.httpServer?.once('listening', () => {
        const address = server.httpServer.address();
        const host = typeof address === 'object' && address ? address.address : server.config.server.host;
        const port = typeof address === 'object' && address ? address.port : server.config.server.port;
        console.info(`[THE SYSTEM dev] listening=${host}:${port} proxy=/api -> ${API_PROXY_TARGET}`);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), apiProxyDiagnostics()],
  server: {
    host: '0.0.0.0',
    port: FRONTEND_PORT,
    strictPort: true,
    proxy: {
      '/api': {
        target: API_PROXY_TARGET,
        changeOrigin: true,
      },
    },
  },
});
