import { alias } from '@stacksjs/alias'
import { config as c } from '@stacksjs/config'
import { path as p } from '@stacksjs/path'
import { server } from '@stacksjs/server'
import type { ViteConfig } from '@stacksjs/types'
import { autoImports, components, cssEngine, devtools, inspect, uiEngine } from '@stacksjs/vite-plugin'
import { defineConfig } from 'vite'
import type { ViteBuildOptions } from '.'

const config = {
  root: p.libsPath('components/vue'),
  envDir: p.projectPath(),
  envPrefix: 'FRONTEND_',
  publicDir: p.publicPath(),
  base: '/libs',

  assetsInclude: [p.publicPath('**/*'), p.resourcesPath('assets/*'), p.resourcesPath('assets/**/*')],

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
    devtools(),
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
        if (format === 'es') return 'index.mjs'

        if (format === 'cjs') return 'index.cjs'

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
  if (command === 'serve') return config

  return config
})
