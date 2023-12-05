import { path as p } from 'stacks:path'
import type { AutoImportsOptions } from 'stacks:types'
import { unheadVueComposablesImports as VueHeadImports } from '@unhead/vue'
import { defu } from 'defu'
import AutoImport from 'unplugin-auto-import/vite'
import type { Plugin } from 'vite'
import { VueRouterAutoImports } from 'unplugin-vue-router'

export function autoImports(options?: AutoImportsOptions): Plugin {
  const defaultOptions: AutoImportsOptions = {
    imports: [
      'pinia',
      'vue',
      'vue-i18n',
      // '@vueuse/core',
      // 'vitepress'
      // { 'stacks:ui': ['CssEngine', 'UiEngine', 'Store', 'presetForms', 'transformerCompileClass'] },
      // { 'stacks:logging': ['dd', 'dump'] }, // we also export `log` in st stacks/cli
      // { 'stacks:validation': ['validate', 'validateAll', 'validateSync', 'validateAllSync'] },
      VueHeadImports, // '@vueuse/head' alternatively
      VueRouterAutoImports,
      {
        'vue-router/auto': ['useLink'],
      },
    ],
    dts: p.frameworkStoragePath('types/auto-imports.d.ts'),
    dirs: [
      p.resourcesPath('functions'),
      p.resourcesPath('stores'),
      // p.resourcesPath('components'), do we need this?

      p.frameworkPath('src'),
    ],
    vueTemplate: true,
  }

  const newOptions = defu(options, defaultOptions)

  return AutoImport(newOptions)
}
