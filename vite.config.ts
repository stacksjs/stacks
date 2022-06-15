import { resolve } from 'path'
import type { UserConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import Unocss from 'unocss/vite'
import PresetIcons from '@unocss/preset-icons'

// https://vitejs.dev/config/
const config: UserConfig = {
  resolve: {
    alias: {
      '~': resolve(__dirname, '/src'),
      '#config': resolve(__dirname, '/config'),
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
      configFile: resolve(__dirname, './unocss.config.ts'),
      mode: 'shadow-dom', // or 'vue-scoped'
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
  ]
}

export default config
