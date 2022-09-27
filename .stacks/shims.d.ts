/// <reference types="vite/client" />
/// <reference types="vitest" />
/// <reference types="vue/ref-macros" />

interface ImportMetaEnv {
  readonly APP_NAME: string
  readonly APP_ENV: string
  readonly APP_KEY: string
  readonly APP_URL: string
  readonly APP_DEBUG: boolean
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare interface Window {
  // extend the window
}

declare module '*.vue' {
  import { type DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
