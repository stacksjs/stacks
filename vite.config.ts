/// <reference types="vitest" />
import { resolve } from 'path'
import type { UserConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import Unocss from 'unocss/vite'
import PresetIcons from '@unocss/preset-icons'
import pkg from './package.json'

process.env.VITE_APP_VERSION = pkg.version
if (process.env.NODE_ENV === 'production')
  process.env.VITE_APP_BUILD_EPOCH = new Date().getTime().toString()

// https://vitejs.dev/config/
const config: UserConfig = {
  resolve: {
    alias: {
      '~': resolve(__dirname, '/src'),
    },
  },

  plugins: [
    Vue({
      reactivityTransform: true, // https://vuejs.org/guide/extras/reactivity-transform.html
      template: {
        compilerOptions: {
          // treat all tags with a dash as custom elements
          isCustomElement: tag => tag.includes('-'),
        },
      },
    }),

    Unocss({
      mode: 'shadow-dom',
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

    // https://github.com/antfu/unplugin-auto-import
    AutoImport({
      imports: ['vue', '@vueuse/core'],
      dts: 'src/auto-imports.d.ts',
      eslintrc: {
        enabled: true,
      },
    }),

    // https://github.com/antfu/unplugin-vue-components
    Components({
      dirs: ['src/components'],
      extensions: ['vue'],
      dts: 'src/components.d.ts',
    }),
  ],

  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'jsdom',
    deps: {
      inline: ['@vue', '@vueuse', 'vue-demi'],
    },
  },
}

export default config
