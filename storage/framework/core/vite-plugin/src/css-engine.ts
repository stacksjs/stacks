import { path as p } from '@stacksjs/path'
import UnoCSS from 'unocss/vite'

export function cssEngine() {
  // export function cssEngine(isWebComponent = false) {
  // return UnoCSS()
  return UnoCSS({
    configFile: p.uiPath('src/uno.config.ts'),
    // mode: isWebComponent ? 'shadow-dom' : 'vue-scoped',
    // content: {
    //   pipeline: {
    //     include: /\.(stx|vue|js|ts|mdx?|elm|html)($|\?)/,
    //     // exclude files
    //     // exclude: []
    //   },
    // },
  })
}
