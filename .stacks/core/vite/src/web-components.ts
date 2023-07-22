import type { ViteConfig } from '@stacksjs/types'
import { frameworkPath, libraryEntryPath, projectPath } from '@stacksjs/path'
import { library } from '@stacksjs/config'
import { server } from '@stacksjs/server'
import { alias } from '@stacksjs/alias'
import type { ViteBuildOptions } from './'
import { defineConfig } from './'

// import { autoImports, components, cssEngine, inspect, uiEngine } from '.'

// const isWebComponent = true

export const webComponentsConfig: ViteConfig = {
  root: frameworkPath('libs/components/web'),
  envDir: projectPath(),
  envPrefix: 'FRONTEND_',

  server,

  resolve: {
    alias,
  },

  optimizeDeps: {
    exclude: ['vue', 'local-pkg', 'vue-starport'],
  },

  plugins: [
    // inspect(),
    // uiEngine(isWebComponent),
    // cssEngine(isWebComponent),
    // autoImports(),
    // components(),
  ],

  build: webComponentsBuildOptions(),
}

export function webComponentsBuildOptions(): ViteBuildOptions {
  return {
    outDir: frameworkPath('components/web/dist'),
    emptyOutDir: true,
    lib: {
      entry: libraryEntryPath('web-components'),
      name: library.webComponents?.name,
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
