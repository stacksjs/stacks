import type { Plugin } from 'vue'
import { RadioGroup, RadioGroupLabel, RadioGroupDescription, RadioGroupOption } from './components'

const plugin: Plugin = {
  install(app) {
    Object.entries({ RadioGroup, RadioGroupLabel, RadioGroupDescription, RadioGroupOption }).forEach(([name, component]) => {
      app.component(name, component)
    })
  },
}

export default plugin
