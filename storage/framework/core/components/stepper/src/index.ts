import type { App, Plugin } from 'vue'

import { Stepper } from './components'
export { Stepper }

const plugin: Plugin = {
  install(app: App) {
    app.component('Stepper', Stepper)
  },
}

export default plugin
