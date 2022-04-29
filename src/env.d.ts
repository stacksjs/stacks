/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/ban-types
  const component: DefineComponent<any, {}, any>
  export default component
}

interface ImportMetaEnv extends Readonly<Record<string, string>> {
  // only `string` type here to avoid hard-to-debug cast problems in your components!
  readonly VITE_APP_VERSION: string
  readonly VITE_APP_BUILD_EPOCH?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
