import type { Plugin } from 'vue'
import { Popover, PopoverButton, PopoverPanel } from './components'

const plugin: Plugin = {
  install(app) {
    Object.entries({ Popover, PopoverButton, PopoverPanel }).forEach(([name, component]) => {
      app.component(name, component)
    })
  },
}

export default plugin
