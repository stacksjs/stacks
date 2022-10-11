/// <reference types="vitest" />
/// <reference types="vite/client" />
/// <reference types="vue/ref-macros" />
/// <reference types="vite-plugin-pages/client" />
/// <reference types="vite-plugin-vue-component-preview/client" />
/// <reference types="vite-plugin-vue-layouts/client" />
/// <reference types="vite-plugin-pwa/client" />

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

// with vite-plugin-vue-markdown, markdown files can be treated as Vue components
declare module '*.md' {
  import { type DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '*.vue' {
  import { type DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
