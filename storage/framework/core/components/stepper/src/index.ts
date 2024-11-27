import type { Plugin } from 'vue'
import { Stepper, Steps } from './components'

const plugin: Plugin = {
  install(app) {
    app.component('Stepper', Stepper)
    app.component('Steps', Steps)
  },
}

export default plugin

export { Stepper, Steps }
