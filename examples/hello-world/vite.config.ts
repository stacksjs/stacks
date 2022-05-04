import { resolve } from 'path'
import Vue from '@vitejs/plugin-vue'
import Unocss from 'unocss/vite'
import PresetIcons from '@unocss/preset-icons'

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
      presets: [
        PresetIcons({
          prefix: 'i-',
          extraProperties: {
            'display': 'inline-block',
            'vertical-align': 'middle',
          },
        }),
      ],
    }),
  ],
}

export default config
