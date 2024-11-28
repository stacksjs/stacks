import type { Plugin } from 'vue'
import { Menu, MenuButton, MenuItem, MenuItems } from './components'

const plugin: Plugin = {
  install(app) {
    Object.entries({ Menu, MenuButton, MenuItem, MenuItems }).forEach(([name, component]) => {
      app.component(name, component)
    })
  },
}

export { Menu, MenuButton, MenuItem, MenuItems }
export default plugin
