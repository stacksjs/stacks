import process from 'node:process'
import { defineConfig, loadEnv } from 'vite'
import type { BuildOptions as ViteBuildOptions } from '@stacksjs/vite'
import Components from 'unplugin-vue-components/vite'
import type { ViteConfig } from '../types/src'
import { libraryEntryPath, libsPath, projectPath, storagePath } from '../path/src'
import { app, library } from '../config/src'
import { alias } from '../alias/src'
import { autoImports, uiEngine } from '../vite/src'

export const vueComponentsConfig: ViteConfig = {
  envDir: projectPath(),
  envPrefix: 'FRONTEND_',
  publicDir: storagePath('public'),

  server: {
    host: app.url,
    open: false,
  },

  resolve: {
    dedupe: ['vue'],
    alias,
  },

  optimizeDeps: {
    exclude: ['stacks', 'vue', 'fsevents', 'emitter', '@stacksjs/utils', '@stacksjs/validation', '@stacksjs/vite', '@stacksjs/server', '@stacksjs/config', 'stacks/utils', 'stacks/validation'],
  },

  plugins: [
    // preview(),
    uiEngine(),
    // cssEngine(),
    autoImports(),
    Components({
      // allow auto load markdown components under `./src/components/`
      extensions: ['stx', 'vue', 'md'],
      // allow auto import and register components used in markdown
      include: [/\.stx$/, /\.stx\?stx/, /\.vue$/, /\.vue\?vue/, /\.md$/],
      dts: 'src/components.d.ts',
    }),
  ],

  build: vueComponentsBuildOptions(),
}

export function vueComponentsBuildOptions(): ViteBuildOptions {
  return {
    outDir: libsPath('components/vue/dist'),
    emptyOutDir: true,
    lib: {
      entry: libraryEntryPath('vue-components'),
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
      external: ['vue', '@stacksjs/vite'],
      output: {
        globals: {
          vue: 'Vue',
        },
      },
    },
  }
}

export default defineConfig(({ command, mode }) => {
  process.env = { ...process.env, ...loadEnv(mode, projectPath(), '') }

  if (command === 'serve')
    return vueComponentsConfig

  return vueComponentsConfig
})
