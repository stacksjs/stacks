import UnoCSS from 'unocss/vite'
import { path as p } from '@stacksjs/path'

export function cssEngine(isWebComponent = false) {
  return UnoCSS({
    configFile: p.uiPath('src/uno.config.ts'),
    mode: isWebComponent ? 'shadow-dom' : 'vue-scoped',
    content: {
      pipeline: {
        include: [/\.(stx|vue|[jt]sx|mdx?|elm|html)($|\?)/],
        // exclude files
        // exclude: []
      },
    },
  })
}
