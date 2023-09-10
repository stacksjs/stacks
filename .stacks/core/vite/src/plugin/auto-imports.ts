import AutoImport from 'unplugin-auto-import/vite'
import { defu } from 'defu'
import type { AutoImportsOptions } from '@stacksjs/types'
import { frameworkPath, projectStoragePath, resourcesPath } from '@stacksjs/path'
import type { Plugin } from 'vite'
import { unheadVueComposablesImports } from '@unhead/vue'

export function autoImports(options?: AutoImportsOptions): Plugin {
  const defaultOptions: AutoImportsOptions = {
    imports: [
      'vue', 'vue-router', 'vue/macros', 'pinia',
      unheadVueComposablesImports,
      // 'vitepress'
      // { '@stacksjs/ui': ['CssEngine', 'UiEngine', 'Store', 'presetForms', 'transformerCompileClass'] },
      // { '@stacksjs/logging': ['dd', 'dump'] }, // we also export `log` in st stacks/cli
      // { '@stacksjs/validation': ['validate', 'validateAll', 'validateSync', 'validateAllSync'] },
    ],
    dirs: [
      resourcesPath('functions'),
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

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return AutoImport(newOptions)
}
