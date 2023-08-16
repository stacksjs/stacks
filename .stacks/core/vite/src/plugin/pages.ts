import { defu } from 'defu'

import type { Options } from 'unplugin-vue-router'
import VueRouter from 'unplugin-vue-router/vite'

// https://github.com/posva/unplugin-vue-router
export function pages(options?: Options) {
  const defaultOptions = {
    extensions: ['.vue', '.md'],
  }

  const newOptions = defu(options, defaultOptions)

  return VueRouter(newOptions)
}

