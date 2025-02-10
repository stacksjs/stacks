import type { Plugin } from 'vue'
import Stepper from './components/Stepper.vue'

const plugin: Plugin = {
  install(app) {
    app.component('Stepper', Stepper)
  },
}

export { Stepper }
export default plugin
