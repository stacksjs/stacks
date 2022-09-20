import { resolve } from 'pathe'
import type { BuildOptions as ViteBuildOptions } from 'vite'
import { defineConfig } from 'vite'
import type { ViteConfig } from '../types'
import { componentsLibrary } from '../../../config/library'
import { atomicCssEngine, autoImports, components, inspect, uiEngine } from '..'
import alias from '../core/alias'
import { _dirname } from '../core/fs'

const config: ViteConfig = {
  root: resolve(_dirname, '../../../components'),

  envPrefix: 'STACKS_',

  server: {
    port: 3333,
    open: true,
  },

  resolve: {
    dedupe: ['vue'],
    alias,
  },

  optimizeDeps: {
    exclude: ['vue'],
  },

  plugins: [
    inspect,

    uiEngine(),

    atomicCssEngine(),

    autoImports,

    components,
  ],

  build: componentsBuildOptions(),
}

export function componentsBuildOptions(): ViteBuildOptions {
  return {
    outDir: resolve(_dirname, '../../components/dist'),
    emptyOutDir: true,
    lib: {
      entry: resolve(_dirname, '../components/index.ts'),
      name: componentsLibrary.name,
      formats: ['cjs', 'es'],
      fileName: (format: string) => {
        if (format === 'es')
          return 'index.mjs'

        if (format === 'cjs')
          return 'index.cjs'

        return 'index.?.js'
      },
    },

    rollupOptions: {
      external: ['vue'],
      output: {
        globals: {
          vue: 'Vue',
        },
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
