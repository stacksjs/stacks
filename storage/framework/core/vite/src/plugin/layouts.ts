import { path as p } from '@stacksjs/path'
import Layouts from 'vite-plugin-vue-layouts'
import type { UserOptions as LayoutOptions } from 'vite-plugin-vue-layouts'

export function layouts(options?: LayoutOptions, isMain = true) {
  if (!isMain)
    return Layouts(options)

  return Layouts({
    layoutsDirs: p.layoutsPath(),
    defaultLayout: p.layoutsPath('default.stx'),
    exclude: [
      p.resourcesPath('layouts/mails'),
    ],
    ...options,
  })
}
