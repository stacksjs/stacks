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

// via `vite-plugin-vue-markdown`, markdown
// files can be treated as Vue components
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
