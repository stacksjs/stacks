import type { BuildOptions as ViteBuildOptions } from 'vite'
import { defineConfig } from 'vite'
import type { ViteConfig } from '@stacksjs/types'
import { buildEntriesPath, componentsPath, frameworkPath, projectPath } from '@stacksjs/path'
import { library } from '@stacksjs/config'
import { server } from '@stacksjs/server'
import { alias } from '../../runtime/alias'
import { autoImports, components, cssEngine, inspect, uiEngine } from '.'

const isWebComponent = true

export const webComponentsConfig: ViteConfig = {
  root: componentsPath(),
  envDir: projectPath(),
  envPrefix: 'APP_',

  server,

  resolve: {
    alias,
  },

  plugins: [
    inspect(),
    uiEngine(isWebComponent),
    cssEngine(isWebComponent),
    autoImports(),
    components(),
  ],

  build: webComponentsBuildOptions(),
}

export function webComponentsBuildOptions(): ViteBuildOptions {
  return {
    outDir: frameworkPath('components/web/dist'),
    emptyOutDir: true,
    lib: {
      entry: buildEntriesPath('web-components.ts'),
      name: library.webComponents.name,
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
    return webComponentsConfig

  // command === 'build'
  return webComponentsConfig
})
