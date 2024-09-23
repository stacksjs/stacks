import { path as p } from '@stacksjs/path'
import type { Plugin } from 'vite'
import Layouts from 'vite-plugin-vue-layouts'
import type { UserOptions as LayoutOptions } from 'vite-plugin-vue-layouts'

export function layouts(options?: LayoutOptions): Plugin {
  const opts = {
    extensions: ['stx', 'vue'],
    layoutsDirs: p.layoutsPath(),
    exclude: [p.layoutsPath('dashboard'), p.layoutsPath('mails')],
    ...options,
  }

  return Layouts(opts)
}
