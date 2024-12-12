import type { Plugin } from 'vite'
import type { UserOptions as LayoutOptions } from 'vite-plugin-vue-layouts'
import { path as p } from '@stacksjs/path'
import Layouts from 'vite-plugin-vue-layouts'

export function layouts(options?: LayoutOptions): Plugin {
  return Layouts({
    extensions: ['stx', 'vue'],
    layoutsDirs: p.layoutsPath(),
    exclude: [p.layoutsPath('dashboard'), p.layoutsPath('mails')],
    ...options,
  })
}
