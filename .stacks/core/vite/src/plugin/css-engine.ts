import UnoCSS from 'unocss/vite'
import { uiPath } from '@stacksjs/path'

export function cssEngine(isWebComponent = false) {
  return UnoCSS({
    configFile: uiPath('src/uno.config.ts'),
  })
}
