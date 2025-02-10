import type { ComponentOptions } from '@stacksjs/types'
import type { Plugin } from 'vite'
import { path as p } from '@stacksjs/path'
import Components from 'unplugin-vue-components/vite'

export function components(options?: ComponentOptions): Plugin {
  return Components({
    extensions: ['stx', 'vue', 'md'],
    include: /\.(stx|vue|md)($|\?)/,
    dirs: [
      p.resourcesPath('components/'),
      p.frameworkPath('defaults/components/'),
      // viewsPath(),
    ],
    dts: p.frameworkPath('types/components.d.ts'),
    ...options,
  })
}
