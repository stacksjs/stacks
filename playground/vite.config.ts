import { defineConfig } from 'vite'
import { plugins, resolveOptions, alias } from '../packages/core/src'
import Vue from '@vitejs/plugin-vue'
import Unocss from 'unocss/vite'
import path from 'path'
import { VUE_PACKAGE_NAME } from '../config/constants'


/** @type {import('vite').UserConfig} */
const config = {
  resolve: {
    dedupe: ['vue'],
    alias,
  },

  plugins: [
    Vue(),

    Unocss({
      configFile: path.resolve(__dirname, '../packages/core/src/config/unocss.ts'),
      // mode: 'vue-scoped', // or 'shadow-dom'
    }),
  ],

  lib: {
    entry: './main.ts',
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
    external: ['vue', '@vueuse/core'],
    output: {
      // exports: 'named',
      globals: {
        vue: 'Vue',
      },
    },
  },
}

// https://vitejs.dev/config
export default defineConfig(({ command }) => {
  if (command === 'serve')
    return config

  // command === 'build'
  return config
})
