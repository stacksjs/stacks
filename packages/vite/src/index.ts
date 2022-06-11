import Vue from '@vitejs/plugin-vue'
import Unocss from 'unocss/vite'
import Inspect from 'vite-plugin-inspect'
import dts from 'vite-plugin-dts'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { resolve } from 'pathe'
import type { BuildOptions } from 'vite'
import { alias as StacksAliases } from '../../../config/alias'
import { VUE_PACKAGE_NAME, WEB_COMPONENTS_PACKAGE_NAME } from '../../../config/constants'
import type { UserOptions } from './options'

export function Stacks() {
// export function Stacks(userOptions: UserOptions = {}) {
  // eslint-disable-next-line no-console
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

export const alias = StacksAliases

export const resolveOptions = {
  dedupe: ['vue'],
  alias,
}

export const buildVueComponents: BuildOptions = {
  lib: {
    entry: resolve(__dirname, 'src/index.ts'),
    name: VUE_PACKAGE_NAME,
    formats: ['cjs', 'es'],
    fileName: (format: string) => {
      if (format === 'es')
        return `${VUE_PACKAGE_NAME}.mjs`

      if (format === 'cjs')
        return `${VUE_PACKAGE_NAME}.cjs`

      // if (format === 'iife')
      //     return `${VUE_PACKAGE_NAME}.global.js`

      return `${VUE_PACKAGE_NAME}.?.js`
    },
  },

  rollupOptions: {
    external: ['vue'],
    output: {
      // exports: 'named',
      globals: {
        vue: 'Vue',
      },
    },
  },

  // sourcemap: true,
  // minify: false,
}

export const buildWebComponents: BuildOptions = {
  lib: {
    entry: resolve(__dirname, 'src/index.ts'),
    name: WEB_COMPONENTS_PACKAGE_NAME,
    formats: ['cjs', 'es'],
    fileName: (format: string) => {
      if (format === 'es')
        return `${WEB_COMPONENTS_PACKAGE_NAME}.mjs`

      if (format === 'cjs')
        return `${WEB_COMPONENTS_PACKAGE_NAME}.cjs`

      // if (format === 'iife')
      //   return 'hello-world-elements.global.js'

      return `${WEB_COMPONENTS_PACKAGE_NAME}.?.js`
    },
    // sourcemap: true,
    // minify: false,;
  },
}
