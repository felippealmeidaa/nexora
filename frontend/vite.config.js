import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '')
    const devProxyTarget = env.VITE_DEV_API_PROXY_TARGET || 'http://127.0.0.1:8000'

    return {
        plugins: [react()],
        resolve: {
            alias: {
                "@": path.resolve(__dirname, "./src"),
            },
        },
        build: {
            rollupOptions: {
                output: {
                    manualChunks: {
                        react: ['react', 'react-dom', 'react-router-dom'],
                        charts: ['recharts'],
                        motion: ['framer-motion'],
                        icons: ['lucide-react'],
                    },
                },
            },
        },
        server: {
            host: '0.0.0.0',
            proxy: {
                '/api': {
                    target: devProxyTarget,
                    changeOrigin: true,
                    secure: false,
                }
            }
        },
        preview: {
            host: '0.0.0.0',
        }
    }
})
