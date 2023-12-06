import Components from 'unplugin-vue-components/vite'
import { path as p } from '@stacksjs/path'
import type { ComponentOptions } from '@stacksjs/types'
import { defu } from 'defu'
import type { Plugin } from 'vite'

export function components(options?: ComponentOptions): Plugin {
  const defaultOptions = {
    // also allow auto-loading markdown components
    extensions: ['vue', 'md'],
    include: [/\.vue$/, /\.vue\?vue/, /\.md$/],
    dirs: [
      p.componentsPath(),
      // viewsPath(),
    ],
    dts: p.frameworkStoragePath('types/components.d.ts'),
  }

  const newOptions = defu(options, defaultOptions)

  return Components(newOptions)
}
