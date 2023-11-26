import Layouts from 'vite-plugin-vue-layouts'
import type { UserOptions as LayoutOptions } from 'vite-plugin-vue-layouts'

export function layouts(options?: LayoutOptions) {
  return Layouts(options)
}
