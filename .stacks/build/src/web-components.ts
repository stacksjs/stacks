import type { BuildOptions as ViteBuildOptions } from 'vite'
import { defineConfig } from 'vite'
import type { ViteConfig } from '@stacksjs/types'
import { webComponentLibrary } from '@stacksjs/config'
import { buildEntriesPath, componentsPath, frameworkPath, projectPath } from '@stacksjs/utils'
import { alias, atomicCssEngine, autoImports, components, inspect, uiEngine } from 'stacksjs'

const isWebComponent = true

const config: ViteConfig = {
  root: componentsPath(),
  envDir: projectPath(),
  envPrefix: 'APP_',

  server: {
    port: 3333,
    open: true,
  },

  resolve: {
    alias,
  },

  plugins: [
    inspect(),
    uiEngine(isWebComponent),
    atomicCssEngine(isWebComponent),
    autoImports(),
    components(),
  ],

  build: webComponentsBuildOptions(),
}

export function webComponentsBuildOptions(): ViteBuildOptions {
  return {
    outDir: frameworkPath('web-components/dist'),
    emptyOutDir: true,
    lib: {
      entry: buildEntriesPath('web-components.ts'),
      name: webComponentLibrary.name,
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
