import { defu } from 'defu'
import Pages from 'vite-plugin-pages'
import type { UserOptions } from 'vite-plugin-pages'

// https://github.com/hannoeru/vite-plugin-pages
export function pages(options?: UserOptions) {
  const defaultOptions = {
    extensions: ['vue', 'md'],
  }
  const newOptions = defu(options, defaultOptions)

  return Pages(newOptions)
}
