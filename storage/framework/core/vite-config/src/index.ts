// import type { Env } from '@stacksjs/env'

// export function loadEnv(...args: Parameters<typeof viteLoadEnv>): Env {
//   return viteLoadEnv(...args) as unknown as Env
// }

export type { BuildOptions as ViteBuildOptions, ViteDevServer } from 'vite'

export * from './example-vue'
export * from './example-wc'
export * from './functions'
export * from './views'
export * from './components'
export * from './web-components'
