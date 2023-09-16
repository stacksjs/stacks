import UnoCSS from 'unocss/vite'

// export function cssEngine(isWebComponent = false) {
export function cssEngine() {
  return UnoCSS({
    configFile: '.stacks/core/ui/src/uno.config.ts',
    // mode: isWebComponent ? 'shadow-dom' : 'vu'
  })
}
