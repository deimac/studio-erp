import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

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
                target: 'http://localhost:4000',
                changeOrigin: true,
            },
            '/uploads': {
                target: 'http://localhost:4000',
                changeOrigin: true,
            },
        },
    },
});
