import { resolve } from 'path'
import type { UserConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import Unocss from 'unocss/vite'
import Inspect from 'vite-plugin-inspect'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
// import { alias } from '../config/alias'

// eslint-disable-next-line no-console
console.log('reachiedn');

// https://vitejs.dev/config/
const config: UserConfig = {
  root: '../playground',
  
  server: {
    port: 3333,
    open: true,
  },
  
  // resolve: {
  //   dedupe: ['vue'],
  //   alias,
  // },

  // optimizeDeps: {
  //   exclude: ['vue', '@vueuse/core', 'unocss/vite'],
  // },

  plugins: [
    Vue(),

    Inspect(),

    Unocss({
      configFile: resolve(__dirname, './src/unocss.ts'),
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
      dirs: ['../components'],
      extensions: ['vue'],
      dts: resolve(__dirname, './types/components.d.ts'),
    }),
  ],
}

// eslint-disable-next-line no-console
// console.log('config is here?', config)

export default config;
