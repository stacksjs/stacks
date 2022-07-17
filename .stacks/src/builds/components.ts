import { resolve } from 'path'
import type { BuildOptions as ViteBuildOptions } from 'vite'
import type { ViteConfig } from '../core'
import { AutoImports, Components, StyleEngine, UiEngine, defineConfig } from '../core'
import alias from '../../../config/alias'
import library from '../../../config/library'

const config: ViteConfig = {
  resolve: {
    dedupe: ['vue'],
    alias,
  },

  optimizeDeps: {
    exclude: ['vue', '@vueuse/core'],
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

    lib: {
      entry: resolve(__dirname, '../../../components/index.ts'),
      name: library.COMPONENTS_PACKAGE_NAME,
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
