import type { Plugin } from 'vue'
import { TransitionChild, TransitionRoot } from './components'

const plugin: Plugin = {
  install(app) {
    Object.entries({ TransitionRoot, TransitionChild }).forEach(([name, component]) => {
      app.component(name, component)
    })
  },
}

export { TransitionChild, TransitionRoot }
export default plugin
