import type { App, Plugin } from 'vue'
import { Stepper } from './components'

const plugin: Plugin = {
  install(app: App) {
    app.component('Stepper', Stepper)
  },
}

export { Stepper }

export default plugin
