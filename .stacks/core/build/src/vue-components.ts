import { defineConfig } from 'vite'
import type { ViteConfig } from '@stacksjs/types'
import { buildEntriesPath, frameworkPath, projectPath } from '@stacksjs/path'
import type { BuildOptions as ViteBuildOptions } from 'vite'
import { library } from '@stacksjs/config'
import { alias } from '@stacksjs/alias'
import { autoImports, components, cssEngine, inspect, uiEngine } from './stacks'

export const vueComponentsConfig: ViteConfig = {
  root: frameworkPath('components/vue'),
  envDir: projectPath(),
  envPrefix: 'FRONTEND_',

  server: {
    port: 3333,
    open: true,
  },

  resolve: {
    dedupe: ['vue'],
    alias,
  },

  optimizeDeps: {
    exclude: ['vue', 'fsevents', '@novu/mandrill', '@maizzle/framework', 'browser-sync-ui'],
  },

  plugins: [
    // preview(),
    uiEngine(),
    cssEngine(),
    autoImports(),
    components(),
    inspect(),
  ],

  build: vueComponentsBuildOptions(),
}

export function vueComponentsBuildOptions(): ViteBuildOptions {
  return {
    outDir: frameworkPath('components/vue/dist'),
    emptyOutDir: true,
    lib: {
      entry: buildEntriesPath('vue-components.ts'),
      name: library.vueComponents?.name,
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
    return vueComponentsConfig

  // command === 'build'
  return vueComponentsConfig
})
