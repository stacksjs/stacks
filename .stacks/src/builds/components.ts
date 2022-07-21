import { resolve } from 'path'
import type { BuildOptions as ViteBuildOptions } from 'vite'
import { library } from '../config'
import type { ViteConfig } from '../core'
import { AutoImports, Components, StyleEngine, UiEngine, defineConfig } from '../core'
import alias from '../alias'

const config: ViteConfig = {
  root: resolve(__dirname, '../../../components'),

  server: {
    port: 3333,
    open: true,
  },

  resolve: {
    dedupe: ['vue'],
    alias,
  },

  optimizeDeps: {
    exclude: ['fsevents'],
  },

  plugins: [
    UiEngine,

    StyleEngine,

    AutoImports,

    Components,
  ],

  build: componentsBuildOptions(),
}

export function componentsBuildOptions(): ViteBuildOptions {
  return {
    outDir: resolve(__dirname, '../../dist/components'),

    // emptyOutDir: true,

    lib: {
      entry: resolve(__dirname, '../../../components/index.ts'),
      name: library.packageName,
      formats: ['cjs', 'es'],
      fileName: (format: string) => {
        if (format === 'es')
          return 'index.mjs'

        if (format === 'cjs')
          return 'index.cjs'

        // if (format === 'iife')
        //     return `index.iife.js`

        return 'index.?.js'
      },
    },

    rollupOptions: {
      external: ['vue', '@vueuse/core'],
      output: {
        // exports: 'named',
        globals: {
          vue: 'Vue',
        },
      },
    },

    // sourcemap: true,
    // minify: false,
  }
}

export default defineConfig(({ command }) => {
  if (command === 'serve')
    return config

  // command === 'build'
  return config
})
