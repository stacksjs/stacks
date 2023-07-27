import { alias } from '@stacksjs/alias'
import { path as p } from '@stacksjs/path'
import { defineConfig } from 'vite'
import type { ViteConfig } from '@stacksjs/types'
import { components } from './plugin/components'
import { uiEngine } from './plugin/ui-engine'
import { autoImports } from './plugin/auto-imports'
import { cssEngine } from './plugin/css-engine'
import { inspect } from './plugin/inspect'
import type { ViteBuildOptions } from './'
import app from '~/config/app'

// import { sslCertificate } from './plugin/ssl-cert' -> NotImplementedError: node:http2 createSecureServer is not yet implemented in Bun. Track the status & thumbs up the issue: https://github.com/oven-sh/bun/issues/887

const config = {
  root: p.frameworkPath('libs/components/vue'),
  envDir: p.projectPath(),
  envPrefix: 'FRONTEND_',
  publicDir: p.storagePath('public'),

  server: {
    host: app.url || 'stacks.test',
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
    cssEngine(), // blocked by: unconfig uses jiti which errors in Bun: https://github.com/oven-sh/bun/issues/1134#issuecomment-1652676500
    inspect(),
    components(),
    // sslCertificate(), // blocked by: node:http2 not yet implemented in Bun
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
      // name: library.vueComponents?.name,
      name: 'test-lib-abc',
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
