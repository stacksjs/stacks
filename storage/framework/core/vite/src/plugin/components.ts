import Components from 'unplugin-vue-components/vite'
import { path as p } from '@stacksjs/path'
import type { ComponentOptions } from '@stacksjs/types'

export function components(options?: ComponentOptions) {
  return Components({
    extensions: ['stx', 'vue', 'md'],
    include: /\.(stx|vue|md)($|\?)/,
    dirs: [
      p.componentsPath(),
      p.uiPath('src/components/'),
      // viewsPath(),
    ],
    dts: p.frameworkPath('types/components.d.ts'),
    ...options,
  })
}
