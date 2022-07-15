import { resolve } from 'path'
import type { PluginOption, UserConfig } from 'vite'
import { defineConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import Unocss from 'unocss/vite'
import Inspect from 'vite-plugin-inspect'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { createApp } from 'vue'

export type ViteConfig = UserConfig

const UiEngine = Vue({
  template: {
    compilerOptions: {
      // treat all tags with a dash as custom elements
      isCustomElement: tag => tag.includes('hello-world'),
    },
  },
})

export function styleEngine() {
  return Unocss({
    configFile: resolve(__dirname, './unocss.ts'),
    mode: 'vue-scoped', // or 'shadow-dom'
  })
}

// https://github.com/antfu/unplugin-auto-import
const autoImports = AutoImport({
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

const components = (dirPath: string, dtsPath: string, extensions: string[]) => Components({
  dirs: [dirPath],
  extensions,
  dts: dtsPath,
})

/**
 * The parsed command-line arguments
 */
export interface StacksOptions {
  componentsSrcPath?: string
  dtsPath?: string
  extensions?: string[]
}

const Stacks = ({
  componentsSrcPath = '../../../components/src',
  dtsPath = '../types/components.d.ts',
  extensions = ['vue'],
}: StacksOptions) => <PluginOption>[
  Inspect(),

  UiEngine,

  styleEngine(),

  autoImports,

  components(componentsSrcPath, dtsPath, extensions),
]

export { resolve, createApp, defineConfig, Stacks, UiEngine, autoImports, components }
