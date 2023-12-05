import UnoCSS from 'unocss/vite'
import { path as p } from 'stacks:path'

export function cssEngine(isWebComponent = false) {
  return UnoCSS({
    configFile: p.uiPath('src/uno.config.ts'),
    mode: isWebComponent ? 'shadow-dom' : 'vue-scoped'
  })
}
