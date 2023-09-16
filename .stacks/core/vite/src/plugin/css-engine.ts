import UnoCSS from 'unocss/vite'

// import { uiPath } from '@stacksjs/path'
// import { runCommand } from '@stacksjs/cli'

export async function cssEngine(isWebComponent = false) {
  return UnoCSS({
    configFile: '.stacks/core/ui/src/uno.config.ts',
    // mode: isWebComponent ? 'shadow-dom' : 'vu'
  })
}
