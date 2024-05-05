import { path as p } from '@stacksjs/path'
import type { AutoImportsOptions } from '@stacksjs/types'
import { unheadVueComposablesImports as VueHeadImports } from '@unhead/vue'
import AutoImport from 'unplugin-auto-import/vite'
import { VueRouterAutoImports } from 'unplugin-vue-router'

export function autoImports(options?: AutoImportsOptions) {
  return AutoImport({
    include: /\.(stx|vue|js|ts|mdx?|elm|html)($|\?)/,
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

    dirs: [p.resourcesPath('components'), p.resourcesPath('functions'), p.resourcesPath('stores'), p.corePath()],

    vueTemplate: true,

    eslintrc: {
      enabled: true,
      filepath: './.eslintrc-auto-import.json', // Default `./.eslintrc-auto-import.json`
      globalsPropValue: true, // Default `true`, (true | false | 'readonly' | 'readable' | 'writable' | 'writeable')
    },

    ...options,
  } as AutoImportsOptions)
}
