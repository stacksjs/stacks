import { resolve } from 'path'
import type { UserConfig } from 'vite'
import { defineConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import Unocss from 'unocss/vite'
import Inspect from 'vite-plugin-inspect'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { alias } from '../../config/alias'
import { defineCustomElement, createApp } from 'vue'

const Stacks = (configFile = './unocss.ts') => [
  Vue({
    template: {
      compilerOptions: {
        // treat all tags with a dash as custom elements
        isCustomElement: tag => tag.includes('hello-world'),
      },
    },
  }),

  Inspect(),

  Unocss({
    configFile: resolve(__dirname, configFile),
    mode: 'vue-scoped', // or 'shadow-dom'
  }),

  // https://github.com/antfu/unplugin-auto-import
  AutoImport({
    imports: ['vue', '@vueuse/core', {
      // TODO: this needs to be dynamically generated
      '@ow3/hello-world-functions': ['count', 'increment', 'isDark', 'toggleDark'],
    }],
    dts: resolve(__dirname, './types/auto-imports.d.ts'),
    eslintrc: {
      enabled: true,
      filepath: resolve(__dirname, './.eslintrc-auto-import.json'),
    },
  }),

  // https://github.com/antfu/unplugin-vue-components
  Components({
    dirs: ['../../components'],
    extensions: ['vue'],
    dts: resolve(__dirname, './types/components.d.ts'),
  }),
]

export {
  Stacks,
  alias,
  resolve,
  createApp,
  defineConfig,
  defineCustomElement,
  UserConfig,
}
