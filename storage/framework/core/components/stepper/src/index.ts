import type { App, Plugin } from 'vue'
import type { OptionParams, StepperProps } from './types'
import Stepper from './components/Stepper.vue'

export { Stepper }

// Export types
export type { OptionParams, StepperProps }

export interface StepperInstance {
  next: () => void
  previous: () => void
  reset: () => void
}

// Plugin installation
export function install(app: App) {
  app.component('Stepper', Stepper)
}

// Create plugin
const plugin: Plugin = {
  install,
}

// Default export
export default plugin

// Auto-install if Vue is found in window
declare global {
  interface Window {
    Vue?: App
  }
}

if (typeof window !== 'undefined' && window.Vue) {
  window.Vue.use(plugin)
}
