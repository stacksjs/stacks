import { defineConfig } from 'vite'
import type { ViteConfig } from '@stacksjs/types'
import { componentLibrary } from '@stacksjs/config'
import { alias, atomicCssEngine, autoImports, components, inspect, preview, uiEngine } from '@stacksjs/framework'
import { buildEntriesPath, componentsPath, frameworkPath, projectPath } from '../../src/helpers'

const config: ViteConfig = {
  root: componentsPath(),
  envDir: projectPath(),
  envPrefix: 'APP_',

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
    preview(),
    uiEngine(),
    atomicCssEngine(),
    autoImports(),
    components(),
    inspect(),
  ],

  build: {
    outDir: frameworkPath('vue-components/dist'),
    emptyOutDir: true,
    lib: {
      entry: buildEntriesPath('vue-components.ts'),
      name: componentLibrary.name,
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
  },
}

export default defineConfig(({ command }) => {
  if (command === 'serve')
    return config

  // command === 'build'
  return config
})
