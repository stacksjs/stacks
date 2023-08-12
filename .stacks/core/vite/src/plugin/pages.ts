import Pages from 'vite-plugin-pages'
import { defu } from 'defu'
import { type PagesOption } from '@stacksjs/types'
import { path as p } from '@stacksjs/path'
import { type Plugin } from 'vite'

// https://github.com/hannoeru/vite-plugin-pages
export function pages(options?: PagesOption): Plugin {
  const defaultOptions = {
    extensions: ['vue', 'md'],
    dirs: [
      p.viewsPath(),
    ],
  }

  const newOptions = defu(options, defaultOptions)

  return Pages(newOptions)
}
