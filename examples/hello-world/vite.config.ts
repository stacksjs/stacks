import { resolve } from 'path'
import Vue from '@vitejs/plugin-vue'
import Unocss from 'unocss/vite'

/** @type {import('vite').UserConfig} */
const config = {
  resolve: {
    alias: {
      '~': resolve(__dirname, '../../src'),
    },
  },

  plugins: [
    Vue({
      reactivityTransform: true, // https://vuejs.org/guide/extras/reactivity-transform.html
    }),

    Unocss({
      mode: 'vue-scoped',
    }),
  ],
}

export default config
