import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const host = process.env.HOST || env.HOST || '127.0.0.1';
  const targetHost = host === '0.0.0.0' || host === '::' ? '127.0.0.1' : host;
  const address = targetHost.includes(':') ? `[${targetHost}]` : targetHost;
  const port = process.env.PORT || env.PORT || '3001';
  return {
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 3000,
    strictPort: true,
    open: false,
    proxy: { '/api': `http://${address}:${port}` },
  },
  };
});
