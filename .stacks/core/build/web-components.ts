import { resolve } from 'pathe'
import type { BuildOptions as ViteBuildOptions } from 'vite'
import { defineConfig } from 'vite'
import type { ViteConfig } from '../types'
import alias from '../alias'
import { atomicCssEngine, autoImports, components, inspect, uiEngine } from '..'
import { webComponentsLibrary } from '../../../config/library'
import { _dirname } from '../utils'

const isWebComponent = true

const config: ViteConfig = {
  root: resolve(_dirname, '../../../components'),
  envDir: resolve(_dirname, '../../../'),
  envPrefix: 'APP_',

  server: {
    port: 3333,
    open: true,
  },

  resolve: {
    alias,
  },

  plugins: [
    inspect,

    uiEngine(isWebComponent),

    atomicCssEngine(isWebComponent),

    autoImports,

    components,
  ],

  build: webComponentsBuildOptions(),
}

export function webComponentsBuildOptions(): ViteBuildOptions {
  return {
    outDir: resolve(_dirname, '../../web-components/dist'),
    emptyOutDir: true,
    lib: {
      entry: resolve(_dirname, '../build/entries/web-components.ts'),
      name: webComponentsLibrary.name,
      formats: ['cjs', 'es'],
      fileName: (format: string) => {
        if (format === 'es')
          return 'index.mjs'

        if (format === 'cjs')
          return 'index.cjs'

        return 'index.?.js'
      },
    },
  }
}

export default defineConfig(({ command }) => {
  if (command === 'serve')
    return config

  // command === 'build'
  return config
})
