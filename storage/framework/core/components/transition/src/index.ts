import type { Plugin } from 'vue'
import { TransitionRoot, TransitionChild } from './components'

const plugin: Plugin = {
  install(app) {
    Object.entries({ TransitionRoot, TransitionChild }).forEach(([name, component]) => {
      app.component(name, component)
    })
  },
}

export default plugin
