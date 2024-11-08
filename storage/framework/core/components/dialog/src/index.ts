import type { Plugin } from 'vue'
import { Dialog } from './components'

const plugin: Plugin = {
  install(app) {
    app.component('Dialog', Dialog)
  },
}

export default plugin

export { Dialog }
