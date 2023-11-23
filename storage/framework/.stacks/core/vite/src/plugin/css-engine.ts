import UnoCSS from 'unocss/vite'
import { path as p } from '@stacksjs/path'

// export function cssEngine(isWebComponent = false) {
export function cssEngine() {
  return UnoCSS({
    configFile: p.uiPath('src/uno.config.ts'),
    // mode: isWebComponent ? 'shadow-dom' : 'vu'
  })
}
