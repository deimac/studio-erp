import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// Backend alvo do proxy (padrão :4000; API_PROXY permite apontar para outra porta)
const api = process.env.API_PROXY || 'http://localhost:4000';

export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        port: 5173,
        proxy: {
            '/trpc': {
                target: api,
                changeOrigin: true,
            },
            '/api': {
                target: api,
                changeOrigin: true,
            },
            '/uploads': {
                target: api,
                changeOrigin: true,
            },
        },
    },
});
