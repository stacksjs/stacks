// import type { Env } from '@stacksjs/env'

// export function loadEnv(...args: Parameters<typeof viteLoadEnv>): Env {
//   return viteLoadEnv(...args) as unknown as Env
// }

export type { BuildOptions as ViteBuildOptions, ViteDevServer } from 'vite'

export * as vueComponentExample from './example-vue'
export * as webComponentExample from './example-wc'
export * as functions from './functions'
export * as views from './views'
export * as vueComponents from './components'
export * as webComponents from './web-components'

// export { ViteDevServer, ViteBuildOptions }
