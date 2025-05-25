import type { Plugin } from 'vite'
import type { UserOptions as LayoutOptions } from 'vite-plugin-vue-layouts'
import { path as p } from '@stacksjs/path'
import Layouts from 'vite-plugin-vue-layouts'

export function layouts(options?: LayoutOptions): Plugin {
  const plugin = Layouts({
    extensions: ['stx', 'vue'],
    layoutsDirs: [p.resourcesPath('layouts')],
    pagesDirs: [p.resourcesPath('views')],
    exclude: [p.layoutsPath('dashboard'), p.layoutsPath('mails')],
    ...options,
  })

  return plugin as unknown as Plugin
}
