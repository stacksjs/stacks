import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'pathe'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import VueI18n from '@intlify/vite-plugin-vue-i18n'
import Vue from '@vitejs/plugin-vue'
import Unocss from 'unocss/vite'
import Inspect from 'vite-plugin-inspect'
import type { PluginOption } from 'vite'

const _dirname = typeof __dirname !== 'undefined'
  ? __dirname
  : dirname(fileURLToPath(import.meta.url))

const inspect = Inspect()

const components = Components({
  dirs: [resolve(_dirname, '../../../components')],
  extensions: ['vue'],
  dts: '../../components.d.ts',
})

const autoImports = AutoImport({
  imports: ['vue', 'vue-i18n', '@vueuse/core', 'vitest', { 'collect.js': ['collect'] }],
  dirs: [
    resolve(_dirname, '../../../functions'),
    resolve(_dirname, '../../../components'),
    resolve(_dirname, '../../../config'),
  ],
  dts: resolve(_dirname, '../../auto-imports.d.ts'),
  vueTemplate: true,
})

// https://github.com/intlify/bundle-tools/tree/main/packages/vite-plugin-vue-i18n
const i18n = VueI18n({
  runtimeOnly: true,
  compositionOnly: true,
  include: [resolve(_dirname, '../../../lang/**')],
})

function atomicCssEngine(isWebComponent = false) {
  return Unocss({
    configFile: resolve(_dirname, '../core/unocss.ts'),
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

export { resolve, Stacks, uiEngine, autoImports, atomicCssEngine, components, inspect, i18n }
