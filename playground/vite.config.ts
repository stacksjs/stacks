import { resolve } from 'path'
import { defineConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import Unocss from 'unocss/vite'
import PresetIcons from '@unocss/preset-icons'
import { alias } from '../alias'

/** @type {import('vite').UserConfig} */
const config = {
  resolve: {
    alias,
  },

  plugins: [
    Vue(),

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

// https://vitejs.dev/config
export default defineConfig(({ command }) => {
  if (command === 'serve')
    return config

  // command === 'build'
  return config
})
