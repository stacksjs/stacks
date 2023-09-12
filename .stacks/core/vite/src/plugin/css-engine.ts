import UnoCSS from 'unocss/vite'
import { uiPath } from '@stacksjs/path'
import { runCommand } from '@stacksjs/cli'

<<<<<<< Updated upstream
export function cssEngine(isWebComponent = false) {
=======
export async function cssEngine(isWebComponent = false) {
  
>>>>>>> Stashed changes
  return UnoCSS({
    configFile: '.stacks/core/ui/src/uno.config.ts',
    // mode: isWebComponent ? 'shadow-dom' : 'vu'
  })
}
