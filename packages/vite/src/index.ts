import Vue from '@vitejs/plugin-vue'
import Unocss from 'unocss/vite'
import Inspect from 'vite-plugin-inspect'
import dts from 'vite-plugin-dts'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { resolve } from 'pathe'
import { alias } from '../../../config/alias'
import { buildVueComponents, buildWebComponents } from '../../composables/src'
// import type { UserOptions } from './options'

function Stacks() {
  // export function Stacks(userOptions: UserOptions = {}) {

  // console.log('userOptions', userOptions)

  return [
    Vue(),

    Unocss({
      configFile: resolve(__dirname, 'unocss.config.ts'),
      mode: 'vue-scoped', // or 'shadow-dom'
    }),

    Inspect(), // only applies in dev mode & visit localhost:3000/__inspect/ to inspect the modules

    dts({
      tsConfigFilePath: resolve(__dirname, '../../../tsconfig.json'),
      insertTypesEntry: true,
      outputDir: './types',
      cleanVueFileName: true,
    }),

    // https://github.com/antfu/unplugin-auto-import
    AutoImport({
      imports: ['vue', '@vueuse/core', {
        '@ow3/hello-world-composable': ['count', 'increment', 'isDark', 'toggleDark'],
      }],
      dts: resolve(__dirname, '../../types/auto-imports.d.ts'),
      eslintrc: {
        enabled: true,
        filepath: resolve(__dirname, '../../.eslintrc-auto-import.json'),
      },
    }),

    // https://github.com/antfu/unplugin-vue-components
    Components({
      dirs: [resolve(__dirname, '../../vue/src/components')],
      extensions: ['vue'],
      dts: resolve(__dirname, '../../types/components.d.ts'),
    }),
  ]
}

const resolveOptions = {
  dedupe: ['vue'],
  alias,
}

export { Stacks, alias, resolveOptions, buildVueComponents, buildWebComponents }
