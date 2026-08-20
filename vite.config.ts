import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API_ALVO = 'http://localhost:3001';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: API_ALVO,
        changeOrigin: false,
        configure: (proxy) => {
          proxy.on('error', (err: any, _req, res: any) => {
            const offline = err?.code === 'ECONNREFUSED' || err?.code === 'ECONNRESET' || err?.code === 'EHOSTUNREACH';
            const mensagem = offline
              ? `A API nao esta no ar em ${API_ALVO}. Rode "npm start" (ou "npm run server") e tente de novo.`
              : `Falha ao falar com a API (${err?.code || 'erro desconhecido'}).`;
            console.error(`[proxy /api] ${err?.code || err?.message}: ${mensagem}`);
            if (!res || res.writableEnded) return;
            if (typeof res.writeHead === 'function' && !res.headersSent) {
              res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
            }
            res.end(JSON.stringify({ ok: false, error: mensagem, code: 'API_OFFLINE' }));
          });
        },
      },
    },
  },
});
