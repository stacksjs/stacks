import { defineConfig, loadEnv as viteLoadEnv } from 'vite'
import type { BuildOptions as ViteBuildOptions, ViteDevServer } from 'vite'
import type { Env } from '@stacksjs/env'

export * as vueComponentExample from './example-vue'
export * as webComponentExample from './example-wc'
export * as functions from './functions'
export * as views from './views'
export * as vueComponents from './components'
export * as webComponents from './web-components'
export * from './stacks'
export * as stacks from './stacks'
export { docsEngine } from './plugin/docs'

function loadEnv(...args: Parameters<typeof viteLoadEnv>): Env {
  return viteLoadEnv(...args) as unknown as Env
}

export { defineConfig, loadEnv }
export { ViteDevServer, ViteBuildOptions }
