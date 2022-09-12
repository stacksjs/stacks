import { resolve } from 'pathe'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import VueI18n from '@intlify/vite-plugin-vue-i18n'
import Vue from '@vitejs/plugin-vue'
import Unocss from 'unocss/vite'
import Inspect from 'vite-plugin-inspect'
import type { PluginOption } from 'vite'

const inspect = Inspect()

const components = Components({
  dirs: [resolve(__dirname, '../../../components')],
  extensions: ['vue'],
  dts: '../../components.d.ts',
})

const autoImports = AutoImport({
  imports: ['vue', 'vue-i18n', '@vueuse/core', 'vitest', { 'collect.js': ['collect'] }],
  dirs: [
    resolve(__dirname, '../../../functions'),
    resolve(__dirname, '../../../components'),
    resolve(__dirname, '../../../config'),
  ],
  dts: resolve(__dirname, '../../auto-imports.d.ts'),
  vueTemplate: true,
})

// https://github.com/intlify/bundle-tools/tree/main/packages/vite-plugin-vue-i18n
const i18n = VueI18n({
  runtimeOnly: true,
  compositionOnly: true,
  include: [resolve(__dirname, '../../../lang/**')],
})

function atomicCssEngine(isWebComponent = false) {
  return Unocss({
    configFile: resolve(__dirname, '../core/unocss.ts'),
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

  i18n,
]

const envPrefix = 'STACKS_'

export { resolve, Stacks, uiEngine, autoImports, atomicCssEngine, components, inspect, envPrefix, i18n }
