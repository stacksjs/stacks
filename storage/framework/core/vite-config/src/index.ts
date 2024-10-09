// import type { Env } from '@stacksjs/env'

// export function loadEnv(...args: Parameters<typeof viteLoadEnv>): Env {
//   return viteLoadEnv(...args) as unknown as Env
// }

export * from './components'

export * from './example-vue'
export * from './example-wc'
export * from './functions'
export * from './views'
export * from './web-components'
export type { BuildOptions as ViteBuildOptions, ViteDevServer } from 'vite'
