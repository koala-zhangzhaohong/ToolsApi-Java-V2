import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
// @ts-expect-error Vite executes this config in Node; the app does not ship Node types.
import fs from 'node:fs'
// @ts-expect-error Vite executes this config in Node; the app does not ship Node types.
import path from 'node:path'

declare const __dirname: string

function projectVersion() {
  const resourceDir = path.resolve(__dirname, '../tools-web/src/main/resources')
  // Match the local runtime profile first, then the shared fallback. This keeps
  // the footer aligned with the version printed by the running API service.
  for (const name of ['application-prod-local.properties', 'application-docker.properties', 'application.properties']) {
    const source = fs.readFileSync(path.join(resourceDir, name), 'utf8')
    const version = source.match(/^spring\.application\.version\.base=(.+)$/m)?.[1]?.trim()
    if (version) return version
  }
  return '0.0.0'
}

function compileDate() {
  const now = new Date()
  const pad = (value: number) => value < 10 ? `0${value}` : String(value)
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}`
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const backend = env.VITE_DEV_PROXY_TARGET || 'http://localhost:8080'

  return {
    plugins: [react()],
    define: {
      __APP_VERSION__: JSON.stringify(projectVersion()),
      __COMPILE_DATE__: JSON.stringify(compileDate()),
    },
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
        '/tools/LanZou': backend,
      },
    },
  }
})
