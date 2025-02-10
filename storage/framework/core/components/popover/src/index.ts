import type { Plugin } from 'vue'
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/vue'

const plugin: Plugin = {
  install(app) {
    Object.entries({ Popover, PopoverButton, PopoverPanel }).forEach(([name, component]) => {
      app.component(name, component)
    })
  },
}

export { Popover, PopoverButton, PopoverPanel }
export default plugin
