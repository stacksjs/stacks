import type { Plugin } from 'vue'
import { Combobox, ComboboxButton, ComboboxInput, ComboboxOption, ComboboxOptions } from './components'

const plugin: Plugin = {
  install(app) {
    Object.entries({ Combobox, ComboboxInput, ComboboxButton, ComboboxOptions, ComboboxOption }).forEach(([name, component]) => {
      app.component(name, component)
    })
  },
}

export default plugin

export { Combobox, ComboboxButton, ComboboxInput, ComboboxOption, ComboboxOptions }
