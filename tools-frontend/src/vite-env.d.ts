/// <reference types="vite/client" />

declare const __APP_VERSION__: string
declare const __COMPILE_DATE__: string

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_DEV_PROXY_TARGET?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
