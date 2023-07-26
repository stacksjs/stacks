import Unocss from 'unocss/vite'
import { path as p } from '@stacksjs/path'

export function cssEngine(isWebComponent = false) {
  return Unocss({
    configFile: p.uiPath('src/unocss.ts'),
    mode: isWebComponent ? 'shadow-dom' : 'vue-scoped',
  })
}
