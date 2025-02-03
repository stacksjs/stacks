import type { Plugin } from 'vue'
import { Switch } from '@headlessui/vue'

const plugin: Plugin = {
  install(app) {
    Object.entries({ Switch }).forEach(([name, component]) => {
      app.component(name, component)
    })
  },
}

export { Switch }
export default plugin
