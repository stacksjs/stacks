import type { Plugin } from 'vue'
import { Stepper } from './components'

const plugin: Plugin = {
  install(app) {
    app.component('Stepper', Stepper)
  },
}

export default plugin

export { Stepper }
