import { resolve } from 'pathe'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import VueI18n from '@intlify/vite-plugin-vue-i18n'
import Vue from '@vitejs/plugin-vue'
import Unocss from 'unocss/vite'
import Inspect from 'vite-plugin-inspect'

export const inspect = Inspect()

export const components = Components({
  dirs: [resolve(__dirname, '../../../components')],
  extensions: ['vue'],
  dts: '../../components.d.ts',
})

export const autoImports = AutoImport({
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
export const i18n = VueI18n({
  runtimeOnly: true,
  compositionOnly: true,
  globalSFCScope: true,
  include: [resolve(__dirname, '../../../lang/**')],
})

export function atomicCssEngine(isWebComponent = false) {
  if (isWebComponent) {
    return Unocss({
      configFile: resolve(__dirname, '../core/unocss.ts'),
      mode: 'shadow-dom',
    })
  }

  return Unocss({
    configFile: resolve(__dirname, '../core/unocss.ts'),
    mode: 'vue-scoped',
  })
}

export function uiEngine(isWebComponent = false) {
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

export const envPrefix = 'STACKS_'
