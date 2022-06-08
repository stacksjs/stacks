import { defineConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import Unocss from 'unocss/vite'
import { alias } from '../alias'

/** @type {import('vite').UserConfig} */
const config = {
  resolve: {
    alias,
  },

  plugins: [
    Vue(),

    Unocss({
      configFile: '../packages/unocss.config.ts',
      mode: 'vue-scoped',
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
