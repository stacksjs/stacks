import { path as p } from '@stacksjs/path'
import UnoCSS from 'unocss/vite'
import type { Plugin } from 'vite'

export function cssEngine(isWebComponent = false): Plugin {
  return {
    name: 'css-engine-plugin',
    ...UnoCSS({
      configFile: p.uiPath('src/unocss.config.ts'),
      mode: isWebComponent ? 'shadow-dom' : 'vue-scoped',
      // content: {
      //   pipeline: {
      //     include: /\.(stx|vue|js|ts|mdx?|elm|html)($|\?)/,
      //     // exclude files
      //     // exclude: []
      //   },
      // },
    }),
  }
}
