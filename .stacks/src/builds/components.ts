import { resolve } from 'path'
import type { BuildOptions as ViteBuildOptions } from 'vite'
import Inspect from 'vite-plugin-inspect'
import Vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import AutoImport from 'unplugin-auto-import/vite'
import { library } from '../config'
import type { ViteConfig } from '../core'
import { StyleEngine, defineConfig } from '../core'
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
    exclude: ['vitepress'],
  },

  plugins: [
    Inspect(),

    // UiEngine,
    Vue(),

    StyleEngine,

    AutoImport({
      imports: ['vue', '@vueuse/core'],
      dirs: [
        resolve(__dirname, '../../../functions'),
        resolve(__dirname, '../../../components'),
        resolve(__dirname, '../../../config'),
      ],
      dts: resolve(__dirname, '../../../auto-imports.d.ts'),
      eslintrc: {
        enabled: true,
        filepath: resolve(__dirname, '../../.eslintrc-auto-import.json'),
      },
    }),

    Components({
      dirs: ['../../../components'],
      extensions: ['vue'],
      dts: '../../../components.d.ts',
    }),
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
      external: ['vitepress', 'vue', '@vueuse/core'],
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
