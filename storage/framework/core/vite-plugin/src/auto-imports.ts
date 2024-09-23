import { path as p } from '@stacksjs/path'
import type { AutoImportsOptions } from '@stacksjs/types'
import { unheadVueComposablesImports as VueHeadImports } from '@unhead/vue'
import AutoImport from 'unplugin-auto-import/vite'
import { VueRouterAutoImports } from 'unplugin-vue-router'
import type { Plugin } from 'vite'

export function autoImports(options?: AutoImportsOptions): Plugin {
  return AutoImport({
    include: /\.(stx|vue|js|ts|mdx?|html)($|\?)/,
    imports: [
      'pinia',
      'vue',
      'vue-i18n',
      // '@vueuse/core',
      // 'vitepress'
      // { '@stacksjs/ui': ['CssEngine', 'UiEngine', 'Store', 'presetForms', 'transformerCompileClass'] },
      // { '@stacksjs/logging': ['dd', 'dump'] }, // we also export `log` in st stacks/cli
      // { '@stacksjs/validation': ['validate', 'validateAll', 'validateSync', 'validateAllSync'] },
      VueHeadImports,
      VueRouterAutoImports,
      {
        'vue-router/auto': ['useLink'],
      },
    ],

    dts: p.frameworkPath('types/auto-imports.d.ts'),
    dirs: [p.userLibsPath('components'), p.userLibsPath('functions'), p.resourcesPath('stores'), p.browserPath('src')],
    // dirs: [p.userLibsPath('components'), p.userLibsPath('functions'), p.resourcesPath('stores'), p.corePath()],
    vueTemplate: true,

    // Generate corresponding .biomelintrc-auto-import.json file.
    // biomejs extends Docs - https://biomejs.dev/guides/how-biome-works/#the-extends-option
    biomelintrc: {
      enabled: true, // Default `false`
      filepath: p.frameworkPath('.biomelintrc-auto-import.json'), // Default `./.biomelintrc-auto-import.json`
    },

    ...options,
  } as AutoImportsOptions)
}
