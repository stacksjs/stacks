import type { UserConfig } from 'vite'
import { defineConfig } from 'vite'
import { buildVueComponents as vueComponents, plugins } from '../composables/src/stacks'
// import { resolve } from 'pathe'
// import { Stacks, resolveOptions } from '../core/src'
import { VUE_PACKAGE_NAME } from '../../config/constants'
// import Vue from '@vitejs/plugin-vue'
import { alias } from '../core/src'

// eslint-disable-next-line no-console
console.log('here?');
// https://vitejs.dev/config/
const config: UserConfig = {
  resolve: {
    dedupe: ['vue'],
    alias,
  },

  plugins,

  optimizeDeps: {
    exclude: ["path", "fs", 'url', 'crypto']
  },

  build: {
    lib: {
      entry: './src/index.ts',
      name: VUE_PACKAGE_NAME,
      formats: ['cjs', 'es'],
      fileName: (format: string) => {
        if (format === 'es')
          return `${VUE_PACKAGE_NAME}.mjs`

        if (format === 'cjs')
          return `${VUE_PACKAGE_NAME}.cjs`

        // if (format === 'iife')
        //     return `${VUE_PACKAGE_NAME}.global.js`

        return `${VUE_PACKAGE_NAME}.?.js`
      },
    },

    rollupOptions: {
      external: ['vue', '@vueuse/core', 'unconfig'],
      output: {
        // exports: 'named',
        globals: {
          vue: 'Vue',
        },
      },
    },
  }
}

// https://vitejs.dev/config
export default defineConfig(({ command }) => {
  // // eslint-disable-next-line no-console
  // console.log('config is', config)

  if (command === 'serve')
    return config

  // command === 'build'
  return config
})
