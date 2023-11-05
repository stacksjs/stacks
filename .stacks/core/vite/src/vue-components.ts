import type { ViteBuildOptions } from './'
import { alias } from '@stacksjs/alias'
import { server } from '@stacksjs/server'
import { config as c } from '@stacksjs/config'
import { path as p } from '@stacksjs/path'
import { defineConfig } from 'vite'
import type { ViteConfig } from '@stacksjs/types'
import { components } from './plugin/components'
import { cssEngine } from './plugin/css-engine'
import { uiEngine } from './plugin/ui-engine'
import { autoImports } from './plugin/auto-imports'
import { inspect } from './plugin/inspect'
// import { stacks } from './plugin/stacks'

const config = {
  root: p.libsPath('components/vue'),
  envDir: p.projectPath(),
  envPrefix: 'FRONTEND_',
  publicDir: p.publicPath(),

  // server: server({
  //   type: 'library',
  // }),

  server: {
    port: 3333,
  },

  resolve: {
    dedupe: ['vue'],
    alias,
  },

  optimizeDeps: {
    exclude: ['vue'],
  },

  plugins: [
    uiEngine(),
    autoImports(),
    cssEngine(),
    inspect(),
    components(),
    // stacks(),
  ],

  build: vueComponentsBuildOptions(),
} satisfies ViteConfig

export function vueComponentsBuildOptions(): ViteBuildOptions {
  return {
    outDir: p.libsPath('components/vue/dist'),
    emptyOutDir: true,
    lib: {
      entry: p.libraryEntryPath('vue-components'),
      name: c.library.vueComponents?.name,
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
      external: ['vue', '@stacksjs/path'],
      input: p.libraryEntryPath('vue-components'),
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

  return config
})
