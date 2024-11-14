import type { Plugin } from 'vue'
import { Combobox, ComboboxInput, ComboboxButton, ComboboxOptions, ComboboxOption } from './components'

const plugin: Plugin = {
  install(app) {
    Object.entries({ Combobox, ComboboxInput, ComboboxButton, ComboboxOptions, ComboboxOption }).forEach(([name, component]) => {
      app.component(name, component)
    })
  },
}

export default plugin
