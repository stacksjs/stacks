import type { Plugin } from 'vite'
import { path as p } from '@stacksjs/path'
import Unocss from 'unocss/vite'

export function cssEngine(isWebComponent = false): Plugin {
  // @ts-expect-error - somehow a pwa error happens when we type `name` in antfus plugins
  return Unocss({
    configFile: p.uiPath('src/uno.config.ts'),
    mode: isWebComponent ? 'shadow-dom' : 'vue-scoped',
    // content: {
    //   pipeline: {
    //     include: /\.(stx|vue|js|ts|mdx?|elm|html)($|\?)/,
    //     // exclude files
    //     // exclude: []
    //   },
    // },
  })
}
