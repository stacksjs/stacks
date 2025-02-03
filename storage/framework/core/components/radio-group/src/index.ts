import type { Plugin } from 'vue'
import { RadioGroup, RadioGroupDescription, RadioGroupLabel, RadioGroupOption } from '@headlessui/vue'

const plugin: Plugin = {
  install(app) {
    Object.entries({ RadioGroup, RadioGroupLabel, RadioGroupDescription, RadioGroupOption }).forEach(([name, component]) => {
      app.component(name, component)
    })
  },
}

export { RadioGroup, RadioGroupDescription, RadioGroupLabel, RadioGroupOption }
export default plugin
