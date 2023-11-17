import { frameworkPath, projectStoragePath, resourcesPath } from '@stacksjs/path'
import type { AutoImportsOptions } from '@stacksjs/types'
import { unheadVueComposablesImports } from '@unhead/vue'
import { defu } from 'defu'
import AutoImport from 'unplugin-auto-import/vite'
import type { Plugin } from 'vite'
import { VueRouterAutoImports } from 'unplugin-vue-router'

export function autoImports(options?: AutoImportsOptions): Plugin {
  const defaultOptions: AutoImportsOptions = {
    imports: [
      'vue',
      'vue-router',
      'vue/macros',
      // '@vueuse/core',
      'pinia',
      unheadVueComposablesImports,
      // 'vitepress'
      // { '@stacksjs/ui': ['CssEngine', 'UiEngine', 'Store', 'presetForms', 'transformerCompileClass'] },
      // { '@stacksjs/logging': ['dd', 'dump'] }, // we also export `log` in st stacks/cli
      // { '@stacksjs/validation': ['validate', 'validateAll', 'validateSync', 'validateAllSync'] },
      'vue-i18n',
      '@vueuse/head',
      VueRouterAutoImports,
      {
        // add any other imports you were relying on
        'vue-router/auto': ['useLink'],
      },
    ],
    dirs: [
      resourcesPath('functions'),
      resourcesPath('stores'),
      resourcesPath('components'),

      // here, we say that everything that lives here in .stacks/src/index.ts will be auto-imported
      frameworkPath('src'),
    ],
    dts: projectStoragePath('framework/types/auto-imports.d.ts'),
    vueTemplate: true,
    eslintrc: {
      enabled: false,
      // filepath: frameworkPath('.eslintrc-auto-import.json'),
    },
  }

  const newOptions = defu(options, defaultOptions)

  return AutoImport(newOptions)
}
