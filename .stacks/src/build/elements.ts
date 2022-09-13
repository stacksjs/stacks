import { resolve } from 'pathe'
import type { BuildOptions as ViteBuildOptions } from 'vite'
import type { ViteConfig } from '../types'
import alias from '../core/alias'
import { atomicCssEngine, autoImports, components, defineConfig, envPrefix, i18n, inspect, uiEngine } from '../core'
import { webComponentLibraryName } from '../../../config/library'

const isWebComponent = true

const config: ViteConfig = {
  root: resolve(__dirname, '../../../components'),

  envPrefix,

  server: {
    port: 3333,
    open: true,
  },

  resolve: {
    dedupe: ['vue'],
    alias,
  },

  optimizeDeps: {
    exclude: ['vue', '@vueuse/core'],
  },

  plugins: [
    inspect,

    uiEngine(isWebComponent),

    atomicCssEngine(isWebComponent),

    autoImports,

    components,

    i18n,
  ],

  build: webComponentsBuildOptions(),
}

export function webComponentsBuildOptions(): ViteBuildOptions {
  return {
    outDir: resolve(__dirname, '../../elements/dist'),

    emptyOutDir: true,

    lib: {
      entry: resolve(__dirname, '../components/index.ts'),
      name: webComponentLibraryName,
      formats: ['cjs', 'es'],
      fileName: (format: string) => {
        if (format === 'es')
          return 'index.js'

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
