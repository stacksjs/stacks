import { resolve } from 'path'
import type { UserConfig } from 'vite'
import { defineConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import Unocss from 'unocss/vite'

// https://vitejs.dev/config/
const config: UserConfig = {
  resolve: {
    alias: {
      '~': resolve(__dirname, '/packages'),
    },
  },

  plugins: [
    Vue({
      template: {
        compilerOptions: {
          // treat all tags with a dash as custom elements
          isCustomElement: tag => tag.includes('hello-word'),
        },
      },
    }),

    Unocss({
      configFile: './unocss.config.ts',
      mode: 'vue-scoped', // or 'shadow-dom'
    }),

    // https://github.com/antfu/unplugin-auto-import
    AutoImport({
      imports: ['vue', '@vueuse/core'],
      dts: 'packages/core/types/auto-imports.d.ts',
      eslintrc: {
        enabled: true,
      },
    }),

    // https://github.com/antfu/unplugin-vue-components
    Components({
      dirs: ['packages/vue/src/components'],
      extensions: ['vue'],
      dts: 'packages/core/types/components.d.ts',
    }),
  ],
}

export default defineConfig(({ command }) => {
  // // eslint-disable-next-line no-console
  // console.log('config is', config)

  if (command === 'serve')
    return config

  // command === 'build'
  return config
})
