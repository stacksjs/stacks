import { alias } from 'stacks:alias'
import { server } from 'stacks:server'
import { config as c } from 'stacks:config'
import { path as p } from 'stacks:path'
import { defineConfig } from 'vite'
import type { ViteConfig } from 'stacks:types'
import { components } from './plugin/components'
import { cssEngine } from './plugin/css-engine'
import { uiEngine } from './plugin/ui-engine'
import { autoImports } from './plugin/auto-imports'
import { inspect } from './plugin/inspect'
import { stacks } from './plugin/stacks'
import type { ViteBuildOptions } from './'

const config = {
  root: p.libsPath('components/vue'),
  envDir: p.projectPath(),
  envPrefix: 'FRONTEND_',
  publicDir: p.publicPath(),
  base: '/libs',

  server: server({
    type: 'library',
  }),

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
    stacks(),
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
      external: ['vue', 'stacks:path'],
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
