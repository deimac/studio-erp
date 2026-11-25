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
    define: {
        __API_URL__: JSON.stringify(process.env.VITE_API_URL || 'http://localhost:4000'),
    },
    server: {
        port: 5174,
        proxy: {
            '/trpc': {
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
