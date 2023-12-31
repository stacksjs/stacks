import { path as p } from '@stacksjs/path'
import type { AutoImportsOptions } from 'src/types/src'
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
      // { '@stacksjs/ui': ['CssEngine', 'UiEngine', 'Store', 'presetForms', 'transformerCompileClass'] },
      // { '@stacksjs/logging': ['dd', 'dump'] }, // we also export `log` in st stacks/cli
      // { '@stacksjs/validation': ['validate', 'validateAll', 'validateSync', 'validateAllSync'] },
      VueHeadImports,
      VueRouterAutoImports,
      {
        'vue-router/auto': ['useLink'],
      },
    ],
    dts: p.frameworkStoragePath('types/auto-imports.d.ts'),
    dirs: [
      p.resourcesPath('components'),
      p.resourcesPath('functions'),
      p.resourcesPath('stores'),
      p.frameworkPath('src'),
    ],
    vueTemplate: true,
  }

  const newOptions = defu(options, defaultOptions)

  return AutoImport(newOptions)
}
