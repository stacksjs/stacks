import type { Plugin } from 'vue'
import { Dialog, DialogPanel } from './components'

const plugin: Plugin = {
  install(app) {
    app.component('Dialog', Dialog)
    app.component('DialogPanel', DialogPanel)
  },
}

export default plugin

export { Dialog, DialogPanel }
