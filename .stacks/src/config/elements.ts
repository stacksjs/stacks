import { resolve } from 'node:path'
import type { BuildOptions as ViteBuildOptions } from 'vite'
import { library } from '../core/config'
import type { ViteConfig } from '../plugin'
import alias from '../core/alias'
import { defineConfig } from '../plugin'
import { atomicCssEngine, autoImports, components, envPrefix, i18n, inspect, uiEngine } from '../plugin/stacks'

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
    outDir: resolve(__dirname, '../../dist/elements'),

    emptyOutDir: true,

    lib: {
      entry: resolve(__dirname, '../../../config/components.ts'),
      name: library.webComponentsLibraryName,
      formats: ['cjs', 'es'],
      fileName: (format: string) => {
        if (format === 'es')
          return 'index.mjs'

        if (format === 'cjs')
          return 'index.cjs'

        return 'index.?.js'
      },

      // sourcemap: true,
      // minify: false,;
    },
  }
}

export default defineConfig(({ command }) => {
  if (command === 'serve')
    return config

  // command === 'build'
  return config
})
