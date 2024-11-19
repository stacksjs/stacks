import type { Plugin } from 'vue'
import { RadioGroup, RadioGroupDescription, RadioGroupLabel, RadioGroupOption } from './components'

const plugin: Plugin = {
  install(app) {
    Object.entries({ RadioGroup, RadioGroupLabel, RadioGroupDescription, RadioGroupOption }).forEach(([name, component]) => {
      app.component(name, component)
    })
  },
}

export default plugin
