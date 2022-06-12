import { defineConfig } from 'vite'
import { plugins, resolveOptions as resolve } from '../packages/core/src'
import Vue from '@vitejs/plugin-vue'
import Unocss from 'unocss/vite'
import path from 'pathe'


// eslint-disable-next-line no-console
console.log('test')

/** @type {import('vite').UserConfig} */
const config = {
  resolve,

  plugins: [
    Vue(),

    Unocss({
      configFile: path.resolve(__dirname, '../../../config/unocss.ts'),
      mode: 'vue-scoped', // or 'shadow-dom'
    }),
  ],
}

// https://vitejs.dev/config
export default defineConfig(({ command }) => {
  if (command === 'serve')
    return config

  // command === 'build'
  return config
})
