import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron/simple';
import path from 'path';

export default defineConfig({
    plugins: [
        react(),
        electron({
            main: {
                entry: 'src/main.ts',
                vite: {
                    build: {
                        outDir: 'dist/main',
                        mixin: 'no-load',
                        minify: false,
                        rollupOptions: {
                            external: ['electron-store'],
                        }
                    },
                },
            },
            preload: {
                input: 'src/preload.ts',
                vite: {
                    build: {
                        outDir: 'dist/preload',
                        minify: false,
                    },
                },
            },
            renderer: {},
        }),
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
        },
    },
    server: {
        host: '127.0.0.1',
        port: 5173,
    },
    build: {
        outDir: 'dist/renderer',
    }
});
