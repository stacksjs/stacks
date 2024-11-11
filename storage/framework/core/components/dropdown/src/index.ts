import type { Plugin } from 'vue'
import * as components from './components'


const plugin: Plugin = {
  install(app) {
    Object.entries(components).forEach(([name, component]) => {
      app.component(name, component)
    })
  },
}

export default plugin

export * from './components'
