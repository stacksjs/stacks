import { resolve } from 'path'
import type { UserConfig } from 'vite'
import { defineConfig as defineBuildConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import Unocss from 'unocss/vite'
import Inspect from 'vite-plugin-inspect'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { alias } from './alias'
import { buildComposables, buildVueComponents, buildWebComponents, buildStacks } from './builds'

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
      '@ow3/hello-world-composable': ['count', 'increment', 'isDark', 'toggleDark'],
    }],
    dts: resolve(__dirname, './types/auto-imports.d.ts'),
    eslintrc: {
      enabled: true,
      filepath: resolve(__dirname, './.eslintrc-auto-import.json'),
    },
  }),

  // https://github.com/antfu/unplugin-vue-components
  Components({
    dirs: ['../../packages/components'],
    extensions: ['vue'],
    dts: resolve(__dirname, './types/components.d.ts'),
  }),
]

export {
  buildVueComponents,
  buildWebComponents,
  buildComposables,
  buildStacks,
  Stacks,
  alias,
  resolve,
  defineBuildConfig,
  UserConfig,
}
