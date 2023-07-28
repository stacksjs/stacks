import Unocss from 'unocss/vite'
import { uiPath } from '@stacksjs/path'

export function cssEngine(isWebComponent = false) {
  return Unocss({
    configFile: uiPath('src/unocss.ts'),
    mode: isWebComponent ? 'shadow-dom' : 'vue-scoped',
  })
}
