import type { Plugin } from 'vue'
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from './components'

const plugin: Plugin = {
  install(app) {
    Object.entries({ Listbox, ListboxButton, ListboxOptions, ListboxOption }).forEach(([name, component]) => {
      app.component(name, component)
    })
  },
}

export { Listbox, ListboxButton, ListboxOption, ListboxOptions }
export default plugin
