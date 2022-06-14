import { defineConfig } from 'vite'
import { alias } from '../packages/core/src'
import Vue from '@vitejs/plugin-vue'
import Unocss from 'unocss/vite'
import path from 'path'
// import { VUE_PACKAGE_NAME } from '../config/constants'

/** @type {import('vite').UserConfig} */
const config = {
  resolve: {
    dedupe: ['vue'],
    alias,
  },

  optimizeDeps: {
    // exclude: ['path', 'fs', 'url', 'crypto']
    exclude: ['@vueuse/core', 'vue', 'unocss', 'vite', 'fs', '@unocss/inspector', 'crypto', 'url']
  },

  plugins: [
    Vue(),

    Unocss({
      configFile: path.resolve(__dirname, '../packages/core/src/config/unocss.ts'),
      mode: 'vue-scoped', // or 'shadow-dom'
    }),
  ]
}

// https://vitejs.dev/config
export default defineConfig(({ command }) => {
  if (command === 'serve')
    return config

  // command === 'build'
  return config
})
