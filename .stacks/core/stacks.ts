import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'pathe'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import Vue from '@vitejs/plugin-vue'
import Unocss from 'unocss/vite'
import Inspect from 'vite-plugin-inspect'
import type { PluginOption } from 'vite'

const _dirname = typeof __dirname !== 'undefined'
  ? __dirname
  : dirname(fileURLToPath(import.meta.url))

const inspect = Inspect()

const components = Components({
  dirs: [resolve(_dirname, '../../components')],
  extensions: ['vue'],
  dts: '../.stacks/components.d.ts',
})

const autoImports = AutoImport({
  imports: ['vue', '@vueuse/core', 'vitest', { 'collect.js': ['collect'] }],
  dirs: [
    resolve(_dirname, '../../functions'),
    resolve(_dirname, '../../components'),
    resolve(_dirname, '../../config'),
  ],
  dts: resolve(_dirname, '../auto-imports.d.ts'),
  vueTemplate: true,
  eslintrc: {
    enabled: true,
  },
})

function atomicCssEngine(isWebComponent = false) {
  return Unocss({
    configFile: resolve(_dirname, './unocss.ts'),
    mode: isWebComponent ? 'shadow-dom' : 'vue-scoped',
  })
}

function uiEngine(isWebComponent = false) {
  if (isWebComponent) {
    return Vue({
      template: {
        compilerOptions: {
          isCustomElement: () => true,
        },
      },
    })
  }

  return Vue()
}

const Stacks = (isWebComponent = false) => <PluginOption>[
  inspect,

  uiEngine(isWebComponent),

  atomicCssEngine(isWebComponent),

  autoImports,

  components,
]

export { resolve, Stacks, uiEngine, autoImports, atomicCssEngine, components, inspect }
