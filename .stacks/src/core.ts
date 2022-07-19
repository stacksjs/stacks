import { resolve } from 'path'
import type { PluginOption, UserConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import Unocss from 'unocss/vite'
import Inspect from 'vite-plugin-inspect'
import AutoImport from 'unplugin-auto-import/vite'
import Comps from 'unplugin-vue-components/vite'
import { createApp } from 'vue'
export { defineConfig } from 'vite'

export type ViteConfig = UserConfig

export const UiEngine = Vue({
  template: {
    compilerOptions: {
      // treat all tags with a dash as custom elements
      isCustomElement: tag => tag.includes('hello-world'),
    },
  },
})

export const StyleEngine = Unocss({
  configFile: resolve(__dirname, './unocss.ts'),
  mode: 'vue-scoped', // or 'shadow-dom'
})

// https://github.com/antfu/unplugin-auto-import
export const AutoImports = AutoImport({
  imports: ['vue', '@vueuse/core',
    // {
    // TODO: this needs to be dynamically generated
    // '@ow3/hello-world-functions': ['count', 'increment', 'isDark', 'toggleDark'],
    // }
  ],
  dts: resolve(__dirname, '../types/auto-imports.d.ts'),
  eslintrc: {
    enabled: true,
    filepath: resolve(__dirname, '../.eslintrc-auto-import.json'),
  },
})

export const Components = Comps({
  dirs: ['../../../components/src'],
  extensions: ['vue'],
  dts: '../types/components.d.ts',
})

export const Stacks = () => <PluginOption>[
  Inspect(),

  UiEngine,

  StyleEngine,

  AutoImports,

  Components,
]

export default { resolve, createApp, Stacks, UiEngine, AutoImports, StyleEngine, Components }
