import type { Plugin } from 'vue'
import { Switch } from './components'

const plugin: Plugin = {
  install(app) {
    Object.entries({ Switch }).forEach(([name, component]) => {
      app.component(name, component)
    })
  },
}

export default plugin
