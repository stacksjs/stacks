import { resolve } from 'path'
import Vue from '@vitejs/plugin-vue'

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
  ],
}

export default config
