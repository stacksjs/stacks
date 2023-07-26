import type { ViteConfig } from '@stacksjs/types'
import { path as p } from '@stacksjs/path'
import { alias } from '@stacksjs/alias'
import { autoImports, components, inspect, sslCertificate, uiEngine } from './stacks'
import { stacks } from './plugin/stacks'

// import { autoImports, components, cssEngine, inspect, sslCertificate, uiEngine } from './stacks'
import type { ViteBuildOptions } from './'
import { defineConfig } from './'

// import { version } from '../package.json'
const version = '0.0.0'
console.log('version', version)

export const vueComponentsConfig: ViteConfig = {
  root: p.frameworkPath('libs/components/vue'),
  envDir: p.projectPath(),
  envPrefix: 'FRONTEND_',
  publicDir: p.storagePath('public'),
  // define: {
  //   Bun,
  // },

  server: {
    https: true,
    host: 'stacks.test',
    // host: app.url || 'stacks.test',
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
    // preview(),
    uiEngine(),
    cssEngine(),
    autoImports(),
    components(),
    inspect(),
    sslCertificate(),
    stacks(),
  ],

  build: vueComponentsBuildOptions(),
}

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
    return vueComponentsConfig

  return vueComponentsConfig
})
