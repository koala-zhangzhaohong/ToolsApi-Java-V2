import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const backend = env.VITE_DEV_PROXY_TARGET || 'http://localhost:8080'

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/legacy-assets': {
          target: backend,
          rewrite: (path) => path.replace(/^\/legacy-assets/, '/assets'),
        },
        '/api': backend,
        '/backend': backend,
        '/tools/Bing': backend,
        '/tools/DouYin/api': backend,
        '/tools/Kugou/api': backend,
        '/tools/Netease': backend,
        '/tools/LanZou/api': backend,
      },
    },
  }
})
